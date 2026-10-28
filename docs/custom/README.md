# 个人二开、官方融合与发布

个人仓库：`https://github.com/haipengTian/sub2api`。官方：`https://github.com/Wei-Shaw/sub2api`。
部署文件位于另一个仓库 `server-ops/sub2api/`，入口域名 `proxy.thpvip.xyz`。

## 当前基线

个人 `v0.2.16-custom.3` 已发布，镜像为 `ghcr.io/haipengtian/sub2api:0.2.16-custom.3`。
该版本沿用 `v0.2.16-custom.2` 的官方融合基线，新增 Credit 风格；发布验证和服务器更新命令见 [版本记录](releases/0.2.16-custom.3.md)。后续以明确的官方稳定 tag 为融合目标，不以仓库当前分支名代替发布记录。
官方远程为 `upstream`，个人远程为 `origin`。

本地已融合官方 `v0.2.19`，候选版本为 `0.2.19-custom.1`，尚未发布。来源、迁移和验证见 [2026-10-29 同步记录](syncs/2026-10-29-v0.2.19.md)。

新增自动融合流程见 [自动融合上游与二开发布](auto-updates.md)：定时获取官方稳定版，
建立融合分支，通过 CI 与发布试构建后发布 custom 版本；冲突时保留当前部署并提示等待。
以下手动流程仍用于处理冲突、人工检查发布工作流变动和主动发布二开功能。

界面二开见 [现代、经典与 Credit 三种风格](appearance.md)：默认现代风格，皮肤与明暗模式独立；Credit 组件与动效见 [移植说明](credit-style.md)。

## 每次同步

先提交本次维护工具并合入个人 `main`。随后在干净工作区中选择**已经核实存在**的官方稳定 tag，或完整提交 SHA：

```bash
git remote -v
# 已配置则不用再次执行：
# git remote add upstream https://github.com/Wei-Shaw/sub2api.git
git ls-remote --tags upstream
# 用已核实的官方 SHA，后续同步时替换为当次目标：
bash tools/custom/sync-upstream.sh ab80abc6d1f929a6864c8804fd077b509d21fda2
```

脚本获取个人 main 与明确的官方目标，只有两次获取均成功才切换分支。
个人 main 只允许快进；分叉时停止，让维护者检查双方提交。
随后建立 `codex/sync-upstream-时间-SHA` 并 merge，保留个人二开历史。
不会强推、重置或自动发布。网络失败不能改用缓存并宣称同步完成。

冲突会保留现场。检查 `git status`，逐个处理，再 `git add` 和 `git merge --continue`。
取消本次融合用 `git merge --abort`；生成的同步记录保留供核对。
在 `docs/custom/syncs/` 补充迁移兼容性、回归与版本，然后提交记录。

## 验证与合入

维护工具测试无需网络、数据库或 Docker：

```bash
bash -n tools/custom/sync-upstream.sh
bash tools/custom/tests/sync-upstream.sh
```

产品验证使用已有流程；根据实际改动运行必要检查，不以维护脚本测试代替产品验证。
使用 Go 1.27.3、pnpm 9，与仓库 CI 保持一致；高版本 pnpm 的配置行为不同，
不要通过修改锁文件绕过版本不匹配：

```bash
cd backend
go test -tags=unit ./...
golangci-lint run ./...
cd ../frontend
pnpm install --frozen-lockfile
pnpm run lint:check
pnpm run typecheck
pnpm run test:run
pnpm run build
```

数据库/缓存改动另外运行集成测试，并在隔离环境验证 SQL 迁移。
融合重点是二开功能、官方修复、接口/权限、流式输出、模型路由与计费。
检查通过后 merge 融合分支到个人 `main`，再推送个人仓库。

## 发布个人镜像

复用 `.github/workflows/release.yml`，不要部署官方镜像替代个人镜像。
确认个人仓库 Actions 已启用、工作流可以写入 Packages，首次发布后确认 GHCR 包可见性。

1. 选择与代码/官方基线对应的个人版本，如 `v0.2.15-custom.2`。已存在的标签不能复用。
2. 更新发布记录（模板见 `release-template.md`），提交到个人 main。
3. 在 GitHub Actions 的 Release 页面选择 `main`，填写已推送的源代码分支，勾选 `dry_run`。
   amd64 服务器可同时勾选 `simple_release`；arm64 使用完整发布。此步只验证构建，不发布。
4. 构建检查通过后，在**该源代码提交**创建并推送个人 tag：

   ```bash
   test -z "$(git status --porcelain)"
   source_sha=$(git rev-parse HEAD)
   git tag -a v0.2.15-custom.2 "$source_sha" -m 'Sub2API custom release'
   git push origin v0.2.15-custom.2
   ```

   tag 自动触发 Release。默认完整发布；要让 tag 触发简化发布，可提前设置仓库变量 `SIMPLE_RELEASE=true`。
   不要在 tag 发布正在执行时重复手动发布同一 tag。
5. 等待 Release 的所有构建、验证与发布成功。目标镜像为
   `ghcr.io/haipengtian/sub2api:0.2.15-custom.2`（示例版本，等待实际发布验证）。
6. 记录 GitHub 发布 URL、源 SHA、镜像摘要与架构，转到 `server-ops/sub2api/README.md` 首次安装或升级。

Release 会把个人默认分支的 VERSION 更新为发布版本，也会生成 `latest`。
服务器脚本只接受固定 custom 标签或 sha256，并在拉取后保存镜像摘要。
修复后的程序单独查询个人 custom 发布，并展示官方融合状态；生产升级继续使用运维脚本，不从内置更新入口切换回官方产物。

## 以后做二开

每项功能建立 `codex/feature-名称`，按功能提交，记录修改入口、接口与回归场景。
优先使用既有配置与扩展点，避免将无关格式整理混入功能提交。
功能合入个人 main 后仍沿用同一套融合、验证、发布、部署流程。
