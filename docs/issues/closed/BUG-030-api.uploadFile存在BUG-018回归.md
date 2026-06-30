# BUG-030: api.uploadFile 存在 BUG-018 回归 —— JSON解析在状态检查之前

**发现日期**: 2026-06-29
**优先级**: P1
**位置**: `app/frontend/src/api.js:29-36` uploadFile 函数
**状态**: 待修复

## 问题描述

`api.uploadFile` 函数没有复用 `request` 封装，自行实现了 fetch 调用，且错误处理顺序与已修复的 BUG-018 相同：先 `res.json()` 再检查 `res.ok`。

```javascript
uploadFile: (file, noteType = 'image') => {
    const form = new FormData();
    form.append('file', file);
    form.append('note_type', noteType);
    return fetch(BASE + '/notes/upload', { method: 'POST', body: form })
      .then(async (res) => {
        const data = await res.json();          // ← 先解析
        if (!res.ok) throw new Error(data.detail || 'Upload failed');  // ← 后检查
        return data;
      });
  },
```

## 影响

- 后端不可用时上传文件报 "Unexpected end of JSON input" 而非友好提示
- BUG-018 修复未覆盖此新增函数

## 修复建议

```javascript
uploadFile: (file, noteType = 'image') => {
    const form = new FormData();
    form.append('file', file);
    form.append('note_type', noteType);
    return fetch(BASE + '/notes/upload', { method: 'POST', body: form })
      .then(async (res) => {
        if (!res.ok) {
          let detail = 'Upload failed';
          try { const data = await res.json(); detail = data.detail || detail; } catch {}
          throw new Error(detail);
        }
        return res.json();
      });
  },
```
