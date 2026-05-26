# Go Game

React + TypeScript + Vite 围棋 Web UI，支持双人对弈、人机对弈、猜先、手顺记录、形势估算和 KataGo 本地引擎接入。

## 开发

```sh
npm run dev
```

## KataGo Bridge

前端无法直接启动本机二进制程序，所以 KataGo 通过本地 Node bridge 提供给浏览器使用：

```sh
npm run bridge
```

默认读取 Homebrew 安装路径：

- Binary: `/opt/homebrew/bin/katago`
- Model: `/opt/homebrew/opt/katago/share/katago/kata1-b18c384nbt-s9996604416-d4316597426.bin.gz`
- Config: `/opt/homebrew/opt/katago/share/katago/configs/gtp_example.cfg`

可以用环境变量覆盖：

```sh
KATAGO_MODEL=/path/to/model.bin.gz KATAGO_CONFIG=/path/to/gtp.cfg npm run bridge
```

如果 bridge 没有运行，人机模式会自动回退到浏览器内置 AI。
