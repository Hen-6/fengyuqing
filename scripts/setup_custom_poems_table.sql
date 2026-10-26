-- ==============================================================================
-- 创建用户自定义/收编诗词表 (user_custom_poems)
-- 执行位置: Supabase 控制台 -> SQL Editor
-- 项目 ID: fpaaepzooyjeeevloiyb
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_custom_poems (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    poem_id TEXT NOT NULL,       -- 唯一标识, 如 "卧云:白玉蟾"
    title TEXT NOT NULL,         -- 标题 "卧云"
    author TEXT NOT NULL,        -- 作者 "白玉蟾"
    dynasty TEXT DEFAULT '',     -- 朝代 "宋代"
    content JSONB NOT NULL,      -- 诗句数组, 如 ["满洞苔钱叠乱青", ...]
    note TEXT DEFAULT '',        -- 注释
    trans TEXT DEFAULT '',       -- 译文
    shangxi TEXT DEFAULT '',     -- 赏析
    tags JSONB DEFAULT '[]'::jsonb, -- 标签
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, poem_id)
);

-- 开启行级安全策略 (RLS)
ALTER TABLE public.user_custom_poems ENABLE ROW LEVEL SECURITY;

-- 策略: 用户只能查看、插入、更新和删除属于自己的收编诗词
CREATE POLICY "Users can manage their own custom poems" ON public.user_custom_poems
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
