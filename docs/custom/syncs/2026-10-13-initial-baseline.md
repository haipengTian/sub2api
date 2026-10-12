# 初始基线同步

- 官方来源：https://github.com/Wei-Shaw/sub2api
- 实际获取的官方 main SHA：`ab80abc6d1f929a6864c8804fd077b509d21fda2`
- 实际获取的个人 origin/main SHA：`ab80abc6d1f929a6864c8804fd077b509d21fda2`
- 同步前本地基线：`3a6fd1c9db07203ca308aaba69e502bc1f35b307`
- 处理方式：个人和官方已相同，本地 main 与维护分支快进 35 个提交，无冲突。
- 源码 VERSION：`0.2.15`
- 官方稳定 tag `v0.2.15` 的实际 commit：`f2669c8cf62555cd92389b3f55920e9e6e7c6ff2`。
- 此 main 快照比该 tag 多 36 个提交；未将 main 快照伪称为稳定 tag。
- 本次增加的维护工具和运维文件尚未提交/发布，未部署服务器。

## 数据迁移

本次从旧本地基线新增 `backend/migrations/242_group_i18n.sql`：为 groups 增加非空 JSONB i18n 列，默认空对象。
静态检查为增量字段迁移；首次服务器部署没有旧生产数据。实际生产恢复与未来升级兼容性仍须按目标版本逐次验证。

## 验证

维护工具的 4 个真实本地 Git 场景、部署文件的 21 个隔离场景、Bash 语法、ShellCheck 和合成 Compose 配置已通过。
Go 1.27.2 的 domain/dto 单元测试、前端类型检查与生产构建、Linux amd64 前端嵌入后端构建已通过。
前端全量测试：371 个文件、2844 个用例全部通过。详细结果见 server-ops/sub2api/verification.md；未运行全量后端测试。
维护测试和本地构建不代表真实镜像、服务器或迁移验证。
