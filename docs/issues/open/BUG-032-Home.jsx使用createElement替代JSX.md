# BUG-032: Home.jsx 使用 React.createElement 替代 JSX

**发现日期**: 2026-06-29
**优先级**: P3
**位置**: `app/frontend/src/pages/Home.jsx` 整个 render 函数
**状态**: 待修复

## 问题描述

Home.jsx 的 render 函数全部使用 `React.createElement(...)` 替代 JSX 语法，代码可读性和可维护性极差：

```javascript
// 当前
React.createElement('div', { style: { ... } },
  React.createElement('h2', { ... }, 'Exams'),
  React.createElement('span', { ... }, exams.length + ' exams')
)
```

预期应使用 JSX：
```jsx
<div style={{ ... }}>
  <h2>试卷</h2>
  <span>{exams.length} 份</span>
</div>
```

## 影响

- 其他组件（ExamModal、App、Nav）均正常使用 JSX
- 仅 Home.jsx 例外，疑似构建工具误转换
- 增加后续维护成本
