import Link from "next/link";

export const metadata = {
  title: "隐私政策 - 风雨情",
  description: "风雨情古诗词练习平台的隐私保护政策",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen paper-texture px-6 pb-8 safe-pt">
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="flex items-center gap-4">
          <Link href="/" className="text-2xl text-text-muted hover:text-accent transition">←</Link>
          <h1 className="text-xl font-bold text-ink">隐私政策</h1>
        </header>

        <div className="guofeng-card p-6 space-y-6 text-sm leading-relaxed text-ink">
          <p className="text-text-muted text-xs">最近更新日期：2026年10月</p>
          
          <section>
            <h2 className="text-lg font-bold mb-2">1. 核心理念与离线优先</h2>
            <p>
              《风雨情》是一款秉持“离线优先”设计理念的古诗词练习工具。本软件的核心字库（包含37万首古诗词及您自定义收编的内容）<strong>均优先加密存储在您的本地设备上（Local Storage / IndexedDB）</strong>。在无需跨端同步时，所有的检索、搜索、学习等核心计算均在您的设备本地通过 Web Worker 离线完成，绝不会向我们的服务器上传您的检索行为。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">2. 我们收集哪些数据？</h2>
            <p>为了给您提供跨设备的学习进度同步服务，在您<strong>主动注册并登录账号后</strong>，我们才会收集并同步以下必要信息：</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-text-muted">
              <li><strong>账号信息</strong>：您注册时提供的电子邮箱地址，以及进行第三方关联时产生的 Discord ID。</li>
              <li><strong>学习进度数据</strong>：您对各首诗词的背诵熟练度评分（星级）、复习时间戳。这些数据被安全地存放在我们的 Supabase 数据库中。</li>
            </ul>
            <p className="mt-2 text-accent text-xs">注意：您在手机或电脑端私自补录、收编的古诗词完整文本，仅保留在您的设备本地硬盘中，不会上传至我们的服务器。</p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">3. 数据使用与共享</h2>
            <p>
              我们承诺，收集到的同步数据<strong>仅用于为您本人提供跨设备进度无缝衔接的服务</strong>。
              我们绝对不会将您的邮箱、学习记录出售、出租或共享给任何第三方广告公司或商业机构。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">4. 您的数据权利</h2>
            <p>
              您完全拥有您的个人数据的所有权。您可以在软件首页的“数据管理”模块，随时将自己的学习进度导出到本地（JSON 格式备份）。如果您希望彻底注销账号并删除云端的所有学习记录，可以通过联系开发者进行清除。
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold mb-2">5. 联系我们</h2>
            <p>
              如果您对本隐私政策有任何疑问、意见或建议，请联系开发者邮箱：<br />
              <a href="mailto:bixistudio@outlook.com" className="text-accent underline">bixistudio@outlook.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
