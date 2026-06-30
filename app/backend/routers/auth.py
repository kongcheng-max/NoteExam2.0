"""V1.2: 用户认证 API"""
import hashlib
import secrets
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, UserResponse, PasswordChange, APIResponse

router = APIRouter(prefix="/api/auth", tags=["用户认证"])

# 简单 token 存储（生产环境应使用 JWT）
_token_store = {}

def _hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def _generate_token() -> str:
    return secrets.token_hex(32)

async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """从 Authorization header 提取当前用户"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    user_id = _token_store.get(token)
    if not user_id:
        return None
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.post("/register", response_model=APIResponse)
async def register(req: UserRegister, db: AsyncSession = Depends(get_db)):
    """用户注册"""
    # 检查邮箱是否已注册
    result = await db.execute(select(User).where(User.email == req.email.strip().lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="该邮箱已注册")

    user = User(
        email=req.email.strip().lower(),
        password_hash=_hash_password(req.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = _generate_token()
    _token_store[token] = user.id

    return APIResponse(
        success=True,
        message="注册成功",
        data={"token": token, "user": {"id": user.id, "email": user.email}},
    )


@router.post("/login", response_model=APIResponse)
async def login(req: UserLogin, db: AsyncSession = Depends(get_db)):
    """用户登录"""
    result = await db.execute(select(User).where(User.email == req.email.strip().lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    if user.password_hash != _hash_password(req.password):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = _generate_token()
    _token_store[token] = user.id

    return APIResponse(
        success=True,
        message="登录成功",
        data={"token": token, "user": {"id": user.id, "email": user.email}},
    )


@router.get("/me", response_model=APIResponse)
async def get_me(user: User = Depends(get_current_user)):
    """获取当前登录用户信息"""
    if not user:
        raise HTTPException(status_code=401, detail="未登录")
    return APIResponse(
        success=True,
        data={"id": user.id, "email": user.email},
    )



@router.put("/password", response_model=APIResponse)
async def change_password(req: PasswordChange, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user:
        raise HTTPException(status_code=401, detail="未登录")

    if user.password_hash != _hash_password(req.old_password):
        raise HTTPException(status_code=400, detail="原密码错误")

    user.password_hash = _hash_password(req.new_password)
    await db.commit()

    return APIResponse(success=True, message="密码修改成功")


@router.post("/logout", response_model=APIResponse)
async def logout(authorization: str = Header(None)):
    """退出登录"""
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
        _token_store.pop(token, None)
    return APIResponse(success=True, message="已退出")
