// src/data/falTools.js
import { toCdnUrl } from '../utils/cdnHelpers';

export const falTools = [

    
    // GEMINI 2.5 FLASH IMAGE EDIT - NEW TOOL
    {
        id: 35,
        name: "Google Nano Banana TEXT2img",
        description: "Advanced AI image editing with edit and enhance images with your own words",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2img_v1.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "8+",
        category: "image",
        toolType: "fal_gemini_flash_image_edit",
        route: "/gemini-flash-image-edit"
    },
    {
      id: 38,
        name: "Speech to Video Creator",
        description: "Transform speech audio into dynamic videos - create talking avatars and animated scenes from voice recordings",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/sound_img-vid.png?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "35+",
        category: "video",
        toolType: "fal_wan22_s2v",
        route: "/wan-22-s2v"
    },
   // QWEN IMAGE TOOLS - NEW ADDITIONS
    {
        id: 36,
        name: "Advanced Image Generator",
        description: "Advanced text-to-image generation high-quality realistic images",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2img_v1.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "8+",
        category: "image",
        toolType: "fal_qwen_image",
        route: "/qwen-image"
    },
    {
        id: 37,
        name: "Advanced Editing Img2Img tool",
        description: "Transform existing images - edit, enhance, and reimagine your photos",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2img_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "10+",
        category: "image",
        toolType: "fal_qwen_image_to_image",
        route: "/qwen-image-to-image"
    },
     // WAN v2.2-a14b TEXT-TO-VIDEO LORA - NEW TOOL
    {
        id: 30,
        name: "Advanced TEXT to Video Tool",
        description: "Make videos from TEXT that describe your ideas, newest version out right now",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
       tokensRequired: "25+",
        category: "video",
        toolType: "fal_wan_v22_text2video_lora",
        route: "/wan-v22-text2video-lora"
    },

    // WAN v2.2-a14b IMAGE-TO-VIDEO LORA - NEW TOOL
    {
        id: 31,
        name: "Advanced IMAGE to Video Tool",
        description: "Make videos from an IMAGE that describe your ideas, newest version out right now",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "30+",
        category: "video",
        toolType: "fal_wan_v22_img2video_lora",
        route: "/wan-v22-img2video-lora"
    },
  // WAN v2.2-a14b VIDEO-TO-VIDEO - NEW TOOL
    {
        id: 33,
        name: "Using words to change video",
        description: "Use AI to edit videos, switch style, change parts, and move things while keeping its structure",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/vid2vid.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "25+",
        category: "video",
        toolType: "fal_wan_v22_video2video",
        route: "/wan-v22-video2video"
    },
  {
        id: 22,
        name: "Advanced IMG2VID tool $$ ",
        description: "Fast image-to-video generation quick turnaround with excellent quality",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "288+",
        category: "video",
        toolType: "fal_veo3_fast",
        route: "/veo3-fast"
    },
    {
        id: 34,
        name: "Superior IMG2VID tool $$$$",
        description: "High-quality image-to-video generation, premium quality with longer processing",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "534+",
        category: "video",
        toolType: "fal_veo3",
        route: "/veo3-standard"
    },

    // FLUX KONTEXT MAX MULTI - NEW MULTI-IMAGE TOOL
    {
        id: 32,
        name: "Compose an image, with iamges",
        description: "Smartly mix many pictures together into one image, composed by your words",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2img_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "15+",
        category: "image",
        toolType: "fal_flux_kontext_max_multi",
        route: "/flux-kontext-max-multi"
    },
//  {
//        id: 9,
//        name: "FLUX Redux Pro",
//        description: "Create image variations with advanced IP-Adapter control for style preservation",
//        image: toCdnUrl("https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
//        tokensRequired: "20+",
//        category: "image",
//        toolType: "fal_flux_redux",
//        route: "/flux-redux"
//    },
    {
        id: 10,
        name: "The Image Manipulator",
        description: "Change things within an image by simply typing what you need changed",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "10+",
        category: "image",
        toolType: "fal_flux_kontext",
        route: "/flux-kontext"
    },
    // AI SCENE MAKER - FEATURED FIRST TOOL
 //   {
 //       id: 21,
 //       name: "AI Scene Maker",
 //       description: "Transform images into cinematic video sequences with advanced AI scene generation",
 //       image: toCdnUrl("https://images.pexels.com/photos/66134/pexels-photo-66134.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
 //       tokensRequired: "250+",
 //       category: "video",
 //       toolType: "ai_scene_gen",
 //       route: "/ai-scene-gen"
 //   },
       
//    {
//        id: 17,
//        name: "FLUX Kontext LoRA",
//        description: "Advanced text-to-image generation with LoRA fine-tuning and context awareness",
//       image: "https://images.pexels.com/photos/8386440/pexels-photo-8386440.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1",
//        tokensRequired: "20+",
//        category: "image",
//        toolType: "fal_flux_kontext_lora",
//        route: "/flux-kontext-lora"
//    },
    {
        id: 11,
        name: "A consistent IMG2Vid Tool ",
        description: "IMAGE2video tools that produces video with undersatnding and consistency",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "50+",
        category: "video",
        toolType: "fal_minimax_hailuo",
        route: "/minimax-hailuo"
    },

    // FUNCTIONAL TOOLS - Page 2 (positions 5-8)
    {
        id: 15,
        name: "Advanced HD IMAGE2video Tool",
        description: "Professional-grade image-to-video creation",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "90+",
        category: "video",
        toolType: "fal_kling_pro",
        route: "/kling-pro"
    },
    {
        id: 18,
        name: "Up to 30 seconds IMAGE2vid tool",
        description: "Advanced IMG2VID tool, creates longer length videos, best to test out your ideas with",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "25+",
        category: "video",
        toolType: "fal_ltxv",
        route: "/ltxv-video"
    },
    {
        id: 23,
        name: "A multi-scene IMAGE2vid tool",
        description: "Advanced scene creation possiblilties with clip based text commands",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/img2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "120+",
        category: "video",
        toolType: "fal_seedance_pro",
        route: "/seedance-pro"
    },

      // FUNCTIONAL TOOLS - Page 1 (positions 1-4)
    // MMAUDIO V2 - NEW AUDIO TOOL
    {
        id: 27,
        name: "Type what you want to hear",
        description: "Advanced text-to-audio generation",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2music.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "audio",
        toolType: "fal_mmaudio_v2",
        route: "/mmaudio-v2"
    },

   //    OMNIHUMAN - NEW TALKING AVATAR TOOL
    {
        id: 29,
        name: "IMAGE + Audio = Talking IMAGE",
        description: "Create realistic talking avatars from images and audio - bring photos to life with speech",
        image: toCdnUrl("https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "30/sec",
        category: "video",
        toolType: "fal_omnihuman",
        route: "/omnihuman"
    },
    {
        id: 20,
        name: "IMAGE Background Remover",
        description: "Remove the background of your images",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/txt2vid_v3.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "image",
        toolType: "fal_bria_bg_remove",
        route: "/bria-bg-remove"
    },
  // MMAUDIO VIDEO2AUDIO - NEW TOOL
    {
        id: 28,
        name: "Give a Video Sound",
        description: "Generate synchronized audio for videos to match the action",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/vid2vid.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "audio",
        toolType: "fal_mmaudio_video2",
        route: "/mmaudio-video2"
    },
    {
        id: 19,
        name: "Increase the clarity of your videos",
        description: "Enhance video quality with this tool",
        image: toCdnUrl("https://xisxqackivlrakfszfop.supabase.co/storage/v1/object/public/user-files/vid2vid.jpg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "50+",
        category: "enhancement",
        toolType: "fal_video_upscaler",
        route: "/fal-video-upscaler"
    },
    {
       id: 26,
       name: "CassetteAI Music Generator",
       description: "Generate original music tracks with AI - from chill beats to epic orchestral pieces",
       image: toCdnUrl("https://images.pexels.com/photos/3784424/pexels-photo-3784424.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
       tokensRequired: "15+",
       category: "audio",
       toolType: "fal_cassetteai_music",
       route: "/cassetteai-music"
    },
   
];