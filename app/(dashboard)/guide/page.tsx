/**
 * User guide page: provides simple usage instructions.
 */
export const metadata = {
  title: "用户指南 | Event Contract Trading",
  description: "事件期货交易辅助网站使用说明",
};

export default function GuidePage() {
  return (
    <article className="prose prose-slate dark:prose-invert max-w-none">
      <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-6">
        交易辅助软件使用指南
      </h1>

      <div className="space-y-6 text-slate-700 dark:text-slate-300">
        <section>
          <p>
            进入网站后，首先要进行站点管理，这样工具才能知道从哪些网站的哪些板块拉取信息，然后进行事件更新。每个事件可能有 1 到多个市场，更新事件是为了获得对应的市场的最新的完整事件信息。
          </p>
          <p>
            更新完的事件会保存，可以在用户事件界面查询已保存事件。在更新或查询事件时可以对事件进行操作，比如修改关注度以及更新所有市场。
          </p>
          <p>
            市场是指事件内可以直接下注的标的。更新过的市场会保存，可以在用户市场界面进行查看。同时用户市场界面可以对市场进行操作，比如修改关注度。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mt-8 mb-3">
            关于关注度
          </h2>
          <p>
            关注度是为了给事件和市场分级，不能为负数。新事件的默认关注度为 1，新市场的默认关注度等于「更新所有市场」操作对应的事件的关注度。
          </p>
          <p>
            关注度为 0 的事件或者市场将只显示在用户事件及用户市场的「我的事件」及「我的市场」中的「不再关注」中，不会在「浏览并关注」的事件或市场中继续显示。
          </p>
          <p>
            特别的，关注度最高的事件或者市场会特别显示在「我的事件」及「我的市场」中的「我最关注」中。
          </p>
        </section>

        <section>
          <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100 mt-8 mb-3">
            每日使用流程
          </h2>
          <p>
            每天日常的使用工具流程应该是：
          </p>
          <ol className="list-decimal list-inside space-y-2 mt-2">
            <li>到事件更新页面点击更新，看是否有新增及变更事件；</li>
            <li>到用户事件页面对自己关心的事件进行「更新全部市场」；</li>
            <li>进入用户市场页面，发现感兴趣的市场后到对应的网站直接去交易。</li>
          </ol>
          <p className="mt-4">
            工具对事件及市场都提供快速复制事件标题功能，可以直接粘贴到对应的网站直接搜索即可。
          </p>
        </section>
      </div>
    </article>
  );
}
