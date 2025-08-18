-- Debug User Generations - Run these queries in Supabase SQL Editor
-- Copy and paste each query one by one to see what's happening

-- 1. Check total generations in system
SELECT 
  'Total Generations' as check_type,
  COUNT(*) as count,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM ai_generations;

-- 2. Check Jim's generations specifically
SELECT 
  'Jims Generations' as check_type,
  COUNT(*) as total,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
WHERE p.email = 'jim@1busyguy.com';

-- 3. Show Jim's recent generations with details
SELECT 
  ag.id,
  ag.generation_name,
  ag.tool_type,
  ag.status,
  ag.created_at,
  ag.completed_at,
  ag.tokens_used,
  ag.metadata->>'fal_request_id' as fal_request_id,
  CASE 
    WHEN ag.output_file_url IS NOT NULL THEN 'Has Output'
    ELSE 'No Output'
  END as has_output
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
WHERE p.email = 'jim@1busyguy.com'
ORDER BY ag.created_at DESC
LIMIT 10;

-- 4. Check for stuck processing generations (older than 30 minutes)
SELECT 
  ag.id,
  ag.generation_name,
  ag.tool_type,
  ag.status,
  ag.created_at,
  EXTRACT(EPOCH FROM (NOW() - ag.created_at))/60 as minutes_old,
  ag.metadata->>'fal_request_id' as fal_request_id,
  p.email
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
WHERE ag.status = 'processing' 
  AND ag.created_at < NOW() - INTERVAL '30 minutes'
ORDER BY ag.created_at DESC;

-- 5. Check if any generations have FAL request IDs
SELECT 
  COUNT(*) as total_with_fal_ids,
  COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_with_fal_ids,
  COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_with_fal_ids
FROM ai_generations 
WHERE metadata->>'fal_request_id' IS NOT NULL;

-- 6. Show recent generations across all users (to see if system is working)
SELECT 
  ag.id,
  p.email,
  ag.generation_name,
  ag.tool_type,
  ag.status,
  ag.created_at,
  ag.metadata->>'fal_request_id' as fal_request_id
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
ORDER BY ag.created_at DESC
LIMIT 20;

-- 7. Check if real-time subscriptions are working (check for recent updates)
SELECT 
  ag.id,
  ag.generation_name,
  ag.status,
  ag.created_at,
  ag.updated_at,
  CASE 
    WHEN ag.updated_at > ag.created_at THEN 'Updated After Creation'
    ELSE 'Never Updated'
  END as update_status
FROM ai_generations ag
JOIN profiles p ON p.id = ag.user_id
WHERE p.email = 'jim@1busyguy.com'
ORDER BY ag.created_at DESC
LIMIT 5;