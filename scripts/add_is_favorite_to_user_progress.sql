-- ==============================================================================
-- 为 user_progress 表添加 is_favorite 重点标记字段与索引
-- 执行位置: Supabase 控制台 -> SQL Editor (https://supabase.com/dashboard/project/fpaaepzooyjeeevloiyb/sql/new)
-- 项目 ID: fpaaepzooyjeeevloiyb
-- ==============================================================================

-- 1. 添加 is_favorite 字段（默认为 false）
ALTER TABLE public.user_progress ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- 2. 添加高效过滤索引（仅对标星重点建立条件索引，速度极快且节省存储空间）
CREATE INDEX IF NOT EXISTS idx_user_progress_favorite ON public.user_progress (user_id, is_favorite) WHERE is_favorite = TRUE;
