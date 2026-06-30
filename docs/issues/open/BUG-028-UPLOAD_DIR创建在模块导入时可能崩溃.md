# BUG-028: UPLOAD_DIR 创建在模块导入时，失败则应用无法启动

**发现日期**: 2026-06-29
**优先级**: P2
**位置**: `app/backend/config.py:30`
**状态**: 待修复

## 问题描述

`config.py` 在模块级别创建上传目录，如果权限不足或路径不可写，整个应用无法启动：

```python
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
```

## 影响

- 部署到只读文件系统时应用直接崩溃
- 无任何容错或提示

## 修复建议

将目录创建移到文件上传时懒初始化，或放在 `lifespan` 启动事件中并捕获异常给出明确日志。
