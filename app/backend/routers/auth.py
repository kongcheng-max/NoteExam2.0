"""V1.4: 用户认证 API — bcrypt + JWT"""
import os
from datetime import datetime, timedelta
import jwt
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import User
from schemas import UserRegister, UserLogin, UserResponse, PasswordChange, APIResponse

router = APIRouter(prefix="/api/auth", tags=["用户认证"])

# BUG-050: 使用原生 bcrypt API 避免 passlib 1.7.4 + bcrypt 5.0.0 不兼容
import bcrypt as _bcrypt

# JWT 配置
JWT_SECRET = os.getenv("JWT_SECRET", "noteexam-jwt-secret-change-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_DAYS = 7


def _hash_password(password: str) -> str:
    return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()


def _verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode(), hashed.encode())


def _create_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=JWT_EXPIRE_DAYS)
    payload = {"sub": user_id, "exp": expire, "iat": datetime.utcnow()}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("sub")
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


async def get_current_user(
    authorization: str = Header(None),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """从 JWT Authorization header 提取当前用户"""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization[7:]
    user_id = _decode_token(token)
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

    token = _create_token(user.id)

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

    # V1.4: 兼容 SHA256 旧密码（首次用 bcrypt 登录失败时回退 SHA256）
    if not _verify_password(req.password, user.password_hash):
        import hashlib
        old_hash = hashlib.sha256(req.password.encode()).hexdigest()
        if user.password_hash == old_hash:
            # 升级旧哈希到 bcrypt
            user.password_hash = _hash_password(req.password)
            user.updated_at = datetime.utcnow()
            await db.commit()
        else:
            raise HTTPException(status_code=401, detail="邮箱或密码错误")

    token = _create_token(user.id)

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
    """修改密码"""
    if not user:
        raise HTTPException(status_code=401, detail="未登录")

    # V1.4: 兼容 SHA256 旧密码验证
    if not _verify_password(req.old_password, user.password_hash):
        import hashlib
        old_hash = hashlib.sha256(req.old_password.encode()).hexdigest()
        if user.password_hash != old_hash:
            raise HTTPException(status_code=400, detail="原密码错误")

    user.password_hash = _hash_password(req.new_password)
    user.updated_at = datetime.utcnow()
    await db.commit()

    return APIResponse(success=True, message="密码修改成功")


@router.post("/logout", response_model=APIResponse)
async def logout():
    """退出登录（JWT 无状态，客户端丢弃 token 即可）"""
    return APIResponse(success=True, message="已退出")
