// src/data/falTools.js
import { toCdnUrl } from '../utils/cdnHelpers';

export const falTools = [

   // WAN 2.2 PROFESSIONAL - NEW TOOL!!
    {
        id: 24,
        name: "WAN v2.2-a14b Video",
        description: "Advanced image-to-video generation with WAN v2.2-a14b model and frame interpolation",
        image: toCdnUrl("https://images.pexels.com/photos/5086477/pexels-photo-5086477.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "20+",
        category: "video",
        toolType: "fal_wan_v22_a14b",
        route: "/wan-v22-a14b"
    },
        
    // WAN v2.2-a14b TEXT-TO-VIDEO LORA - NEW TOOL
    {
        id: 30,
        name: "WAN v2.2 Text2Video LoRA",
        description: "Advanced text-to-video generation with WAN v2.2-a14b model and LoRA fine-tuning support",
        image: toCdnUrl("https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
       tokensRequired: "25+",
        category: "video",
        toolType: "fal_wan_v22_text2video_lora",
        route: "/wan-v22-text2video-lora"
    },

    // WAN v2.2-a14b IMAGE-TO-VIDEO LORA - NEW TOOL
    {
        id: 31,
        name: "WAN v2.2 Img2Video LoRA",
        description: "Advanced image-to-video generation with WAN v2.2-a14b model and LoRA fine-tuning support",
        image: toCdnUrl("https://images.pexels.com/photos/3379933/pexels-photo-3379933.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "30+",
        category: "video",
        toolType: "fal_wan_v22_img2video_lora",
        route: "/wan-v22-img2video-lora"
    },
  // WAN v2.2-a14b VIDEO-TO-VIDEO - NEW TOOL
    {
        id: 33,
        name: "WAN v2.2 Video2Video",
        description: "Transform existing videos with AI - change style, content, and motion while preserving structure",
        image: toCdnUrl("https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "25+",
        category: "video",
        toolType: "fal_wan_v22_video2video",
        route: "/wan-v22-video2video"
    },

    // FLUX KONTEXT MAX MULTI - NEW MULTI-IMAGE TOOL
    {
        id: 32,
        name: "FLUX Kontext Max Multi",
        description: "Advanced multi-image composition with FLUX Pro Kontext Max - combine multiple images intelligently",
        image: toCdnUrl("https://images.pexels.com/photos/3861958/pexels-photo-3861958.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "15+",
        category: "image",
        toolType: "fal_flux_kontext_max_multi",
        route: "/flux-kontext-max-multi"
    },
  {
        id: 9,
        name: "FLUX Redux Pro",
        description: "Create image variations with advanced IP-Adapter control for style preservation",
        image: toCdnUrl("https://images.pexels.com/photos/1762851/pexels-photo-1762851.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "20+",
        category: "image",
        toolType: "fal_flux_redux",
        route: "/flux-redux"
    },
    {
        id: 10,
        name: "FLUX Kontext",
        description: "Generate images with context-aware composition and spatial understanding",
        image: toCdnUrl("https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
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

    // MMAUDIO VIDEO2AUDIO - NEW TOOL
    {
        id: 28,
        name: "MMAudio Video2Audio",
        description: "Generate synchronized audio for videos - perfect soundtracks that match your content",
        image: toCdnUrl("https://images.pexels.com/photos/3784424/pexels-photo-3784424.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "audio",
        toolType: "fal_mmaudio_video2",
        route: "/mmaudio-video2"
    },

    

    // FUNCTIONAL TOOLS - Page 1 (positions 1-4)
    // MMAUDIO V2 - NEW AUDIO TOOL
    {
        id: 27,
        name: "MMAudio v2",
        description: "Advanced text-to-audio generation with high-quality synthesis and precise control",
        image: toCdnUrl("https://images.pexels.com/photos/1190297/pexels-photo-1190297.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "audio",
        toolType: "fal_mmaudio_v2",
        route: "/mmaudio-v2"
    },

   //    OMNIHUMAN - NEW TALKING AVATAR TOOL
    {
        id: 29,
        name: "Omnihuman Talking Avatar",
        description: "Create realistic talking avatars from images and audio - bring photos to life with speech",
        image: toCdnUrl("https://images.pexels.com/photos/3785079/pexels-photo-3785079.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "30/sec",
        category: "video",
        toolType: "fal_omnihuman",
        route: "/omnihuman"
    },
    
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
        name: "Minimax Hailuo Video",
        description: "Transform images into cinematic videos with Hailuo's advanced AI",
        image: toCdnUrl("https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "50+",
        category: "video",
        toolType: "fal_minimax_hailuo",
        route: "/minimax-hailuo"
    },

    // FUNCTIONAL TOOLS - Page 2 (positions 5-8)
    {
        id: 15,
        name: "Kling Pro Video",
        description: "Professional-grade image-to-video with Kling v2.1 Pro model",
        image: toCdnUrl("https://images.pexels.com/photos/3379933/pexels-photo-3379933.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "90+",
        category: "video",
        toolType: "fal_kling_pro",
        route: "/kling-pro"
    },
    {
        id: 18,
        name: "LTXV Video Creator",
        description: "Advanced image-to-video generation with extensive customization options",
        image: toCdnUrl("https://images.pexels.com/photos/2695679/pexels-photo-2695679.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "25+",
        category: "video",
        toolType: "fal_ltxv",
        route: "/ltxv-video"
    },
    {
        id: 23,
        name: "Seedance Pro Video",
        description: "Professional image-to-video generation with Seedance Pro technology",
        image: toCdnUrl("https://images.pexels.com/photos/3379933/pexels-photo-3379933.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "120+",
        category: "video",
        toolType: "fal_seedance_pro",
        route: "/seedance-pro"
    },

    // COMING SOON TOOLS - Page 3+ (positions 9+)
    {
        id: 26,
        name: "CassetteAI Music Generator",
        description: "Generate original music tracks with AI - from chill beats to epic orchestral pieces",
        image: toCdnUrl("https://images.pexels.com/photos/164821/pexels-photo-164821.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "15+",
        category: "audio",
        toolType: "fal_cassetteai_music",
        route: "/cassetteai-music"
    },
    {
        id: 22,
        name: "HiDream I1 Dev",
        description: "Advanced text-to-image generation with HiDream I1 development model",
        image: toCdnUrl("https://images.pexels.com/photos/956999/milky-way-starry-sky-night-sky-star-956999.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "7+",
        category: "image",
        toolType: "fal_hidream_i1",
        route: "/hidream-i1"
    },
    {
        id: 20,
        name: "BRIA Background Remover",
        description: "Professional AI-powered background removal with precision edge detection",
        image: toCdnUrl("https://images.pexels.com/photos/4065876/pexels-photo-4065876.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "5+",
        category: "image",
        toolType: "fal_bria_bg_remove",
        route: "/bria-bg-remove"
    },
    {
        id: 19,
        name: "FAL Video Upscaler",
        description: "Enhance video quality with AI-powered upscaling (2x, 4x, 8x)",
        image: toCdnUrl("https://images.pexels.com/photos/3945313/pexels-photo-3945313.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "50+",
        category: "enhancement",
        toolType: "fal_video_upscaler",
        route: "/fal-video-upscaler"
    },
    {
        id: 16,
        name: "AI Auto Video Caption",
        description: "Automatically generate and embed captions in videos with multi-language support",
        image: toCdnUrl("https://images.pexels.com/photos/7991579/pexels-photo-7991579.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "10+",
        category: "video",
        comingSoon: true
    },
    {
        id: 3,
        name: "AI Video Extender",
        description: "Extend video duration using AI frame interpolation and smart content generation",
        image: toCdnUrl("https://images.pexels.com/photos/3379934/pexels-photo-3379934.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&dpr=1"),
        tokensRequired: "20+",
        category: "video",
        comingSoon: true
    },
];