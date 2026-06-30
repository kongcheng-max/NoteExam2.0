# BUG-050: bcrypt 5.0.0 与 passlib 1.7.4 版本不兼容导致用户认证完全不可用

**优先级**: P0 (阻塞主流程)  
**阶段**: V1.4  
**发现日期**: 2026-06-30  
**模块**: 后端用户认证  
**文件**: `app/backend/routers/auth.py`  
**依赖**: `bcrypt==5.0.0`、`passlib==1.7.4`

## 问题描述

`bcrypt` 5.0.0 版本重构了内部 API，移除了 `__about__` 属性。`passlib` 1.7.4 在初始化 bcrypt 后端时会访问 `bcrypt.__about__.__version__`，导致 `AttributeError`。

错误链：
```
AttributeError: module 'bcrypt' has no attribute '__about__'
→ ValueError: password cannot be longer than 72 bytes...
```

这导致 `CryptContext(schemes=["bcrypt"])` 初始化后，所有 `hash()` 和 `verify()` 调用都抛出异常，注册和登录接口全部返回 **500 Internal Server Error**。

## 复现步骤

1. 启动后端
2. `POST /api/auth/register` → 500 Internal Server Error（空响应体）
3. `POST /api/auth/login` → 500 Internal Server Error（空响应体）

## 期望行为

- 注册/登录正常返回 200 或对应的业务错误码（409/401）
- 密码正常进行 bcrypt 哈希和验证

## 修复建议

**方案一（推荐）**：降级 bcrypt 到兼容版本
```bash
pip install bcrypt==4.1.3
```

**方案二**：升级 passlib 替代方案
- 使用 `bcrypt` 原生 API 替代 passlib
- 或迁移到 `passlib[bcrypt]` 的替代实现

## 影响范围

- 用户注册（POST /api/auth/register）
- 用户登录（POST /api/auth/login）
- 修改密码（PUT /api/auth/password）
- 所有依赖 `get_current_user` 的鉴权路由
