# 自动融合上游与二开发布

程序检查版本时分开查询官方稳定版与个人 `vX.Y.Z-custom.N` 发布。官方新版只表示有新的融合目标，不能安装官方二进制或镜像替换二开程序。个人 custom 发布虽然在 GitHub 标为 prerelease，仍然是二开升级来源；草稿、官方标签与 rc 标签不计入。

## 工作流程

`Custom upstream fusion and release` 工作流合入个人默认分支后，每六小时检查一次官方最新稳定版，也可以在 Actions 页面手动运行：

https://github.com/haipengTian/sub2api/actions/workflows/custom-auto-sync.yml

1. 获取最新官方稳定 tag 和个人 main，建立 `codex/sync-vX.Y.Z-custom.N-运行ID-尝试次数` 分支。按同一基础版本已有标签确定 custom 修订号。
2. 真正 merge 官方提交，保留双方历史。`backend/cmd/server/VERSION` 是生成字段，可自动改为新 custom 版本；其余代码冲突停止融合。上游发布工作流的变动也需要人工检查，因为仓库默认令牌无法授权任意工作流变更。
3. 无冲突时推送候选分支，执行完整 CI，再执行不发布的 Release 构建，验证所选架构的二进制和镜像。试构建与正式发布使用独立产物名称。
4. 验证成功后再次确认个人 main 未变化，将已验证提交快进到 main 并原子推送 custom tag；任何步骤失败都不会强推。
5. 显式调用 Release 发布个人镜像与 GitHub Release。不能只依赖标签事件：`GITHUB_TOKEN` 推送的标签不会启动新的工作流。

自动流程仅处理源码和发布，服务器仍使用已固定的镜像摘要。服务检查 GitHub 时只读取状态，不需要服务器上的 GitHub 写入令牌。

状态文件位于 `codex/custom-sync-state` 分支的 `custom-sync.json`，包含官方/个人 SHA、候选分支、目标标签、冲突文件和运行链接。不要把状态文件复制进 main。

## 页面与失败处理

| 状态 | 页面含义 | 后续处理 |
| --- | --- | --- |
| waiting | 等待二开版本融合发布 | 等待下一次定时检查或手动运行 |
| conflict | 上游融合存在冲突 | 人工处理记录中的冲突 |
| manual_review | 上游修改了发布工作流 | 人工检查、融合和验证工作流 |
| checking | 正在融合验证 | 当前版本继续运行 |
| publishing | 正在发布二开版本 | 等待镜像与 Release 完成 |
| checks_failed | 验证或晋级失败 | 查看失败任务，修复后重试 |
| publish_failed | 发布失败 | 查看发布任务，重试已有标签 |
| up_to_date | 二开已覆盖官方基础版本 | 若有更新的 custom 修订号，页面提供个人镜像升级命令 |
| unknown | 暂时无法确认发布状态 | 保留当前版本，检查网络后刷新 |

同一官方提交与个人基线失败后，定时任务不会反复建立分支。手动运行时勾选 `retry` 可以重新尝试。main 在验证期间推进会使本次晋级停止，下一次以新 main 重新融合。

若 tag/main 已晋级、发布中断，且 main 仍指向该已验证提交，`retry` 会校验已有 tag 并仅恢复发布，不再生成新标签。如果 main 后来又有新提交，可在原运行中重跑失败任务，或手动运行既有 `Release` 工作流，填写失败的 **custom tag**，保持 `dry_run=false`。不要移动或覆盖已有标签。

冲突分支包含个人基线及 `docs/custom/syncs/*-conflicts.json` 报告，不带冲突标记代码；报告记录精确的 `upstream_sha`。人工处理示例：

```bash
git fetch origin
git switch --track origin/<报告中的融合分支>
git fetch upstream <报告中的 upstream_tag>
git merge --no-ff <报告中的 upstream_sha>
# 处理冲突，设置新 custom VERSION，完成 merge，执行 CI 与 Release dry_run。
```

解决后的分支需要按人工融合流程检查并合入 main，再发布对应 custom tag。不要盲目采用 ours/theirs 覆盖整片二开代码。

## 服务器升级

只有 GitHub Release 和镜像发布成功后，页面才把对应个人版本作为可升级版本。升级示例中的版本必须替换为实际发布标签：

```bash
cd /opt/server-ops/sub2api
bash update.sh ghcr.io/haipengtian/sub2api:<已发布的版本，不带 v>
bash status.sh
```

`update.sh` 会先备份再更新固定镜像。出现冲突、验证失败或网络问题时，生产容器不会被自动改动。首次安装此修复仍需手动升级个人镜像，此后页面才能显示新融合状态。`/health` 成功只证明服务存活，升级后仍要验证登录和实际代理请求。

## 本地验证

```bash
python -m unittest discover -s tools/custom/tests -p 'test_*.py'
bash tools/custom/tests/sync-upstream.sh
cd backend
go test -tags=unit ./internal/service ./internal/repository ./internal/handler/admin
cd ../frontend
pnpm run lint:check
pnpm run typecheck
pnpm exec vitest run src/components/common/__tests__/VersionBadge.custom.spec.ts src/stores/__tests__/app.customVersion.spec.ts
pnpm run build
```

协调脚本仅允许在个人仓库 GitHub Actions 中执行；本地测试使用隔离 Git 仓库，不发布真实镜像。
