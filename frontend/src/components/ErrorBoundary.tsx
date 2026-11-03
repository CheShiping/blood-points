import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * 全局错误边界：捕获子组件渲染期异常，
 * 避免整页白屏，并将错误内容直接显示在页面上便于定位。
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("页面渲染异常:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 32, fontFamily: "system-ui" }}>
          <h2 style={{ color: "#b91c1c" }}>页面出现异常</h2>
          <pre
            style={{
              whiteSpace: "pre-wrap",
              background: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: 8,
              padding: 16,
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {this.state.error.message}
            {"\n\n"}
            {this.state.error.stack?.slice(0, 2000)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: 12,
              padding: "8px 20px",
              background: "#dc2626",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
