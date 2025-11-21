# AI Model Configuration Guide for Vision Analysis

## Overview

The updated AIRIS system now uses **vision-enabled AI models** to analyze iris images with topographic overlay maps. This provides significantly better accuracy in detecting findings and identifying zones.

## Recommended Models

### OpenAI (Recommended for Stability)

#### GPT-4o (Best Quality)
- **Model ID**: `gpt-4o`
- **Pros**: Highest accuracy, excellent vision capabilities
- **Cons**: Higher cost (~$2.50 per 1M input tokens, $10 per 1M output tokens)
- **Best for**: Professional use, detailed analysis
- **Configuration**:
  ```
  Provider: openai
  Model: gpt-4o
  API Key: sk-...
  ```

#### GPT-4o Mini (Balanced)
- **Model ID**: `gpt-4o-mini`
- **Pros**: Good accuracy, lower cost
- **Cons**: Slightly less detailed than GPT-4o
- **Cost**: ~$0.15 per 1M input tokens, $0.60 per 1M output tokens
- **Best for**: Regular use, good balance
- **Configuration**:
  ```
  Provider: openai
  Model: gpt-4o-mini
  API Key: sk-...
  ```

### Google Gemini (Free Tier Available)

#### Gemini 1.5 Pro (High Quality)
- **Model ID**: `gemini-1.5-pro`
- **Pros**: Excellent vision, generous free tier
- **Cons**: Slightly different output style
- **Cost**: Free tier includes 50 requests/day
- **Best for**: Testing, development, budget-conscious users
- **Configuration**:
  ```
  Provider: gemini
  Model: gemini-1.5-pro
  API Key: AIza...
  ```

#### Gemini 1.5 Flash (Fast & Efficient)
- **Model ID**: `gemini-1.5-flash`
- **Pros**: Very fast, lower cost, good quality
- **Cons**: Less detailed than Pro version
- **Cost**: Very affordable even for paid tier
- **Best for**: High-volume analysis, quick results
- **Configuration**:
  ```
  Provider: gemini
  Model: gemini-1.5-flash
  API Key: AIza...
  ```

## How to Configure

### Step 1: Get API Key

#### For OpenAI:
1. Go to https://platform.openai.com/api-keys
2. Sign in or create account
3. Click "Create new secret key"
4. Copy the key (starts with `sk-`)
5. **Important**: Save it securely, you can't see it again

#### For Google Gemini:
1. Go to https://makersuite.google.com/app/apikey
2. Sign in with Google account
3. Click "Get API key" or "Create API key"
4. Copy the key (starts with `AIza`)

### Step 2: Configure in AIRIS

1. Open the application
2. Go to **Admin Panel** (gear icon in bottom right)
3. Enter admin password (default: check with repository owner)
4. Navigate to **"AI Model Configuration"** tab
5. Fill in:
   - **Provider**: Select `openai` or `gemini`
   - **Model**: Enter exact model ID (see above)
   - **API Key**: Paste your API key
   - **Use Custom Key**: Check the box
6. Click **"Save Configuration"**

### Step 3: Verify Setup

1. Start a new analysis
2. Check the logs (click "Покажи логове" / "Show logs")
3. Look for:
   - ✅ "🎨 Създаване на композитно изображение..." (Creating composite image)
   - ✅ "📷 Изображение дължина: X KB" (Image size)
   - ✅ "🔑 Използване на API с изображение" (Using API with image)
4. If you see these messages, vision is working!

## Cost Estimation

### Typical Analysis Cost per Patient:

**OpenAI GPT-4o:**
- Input: ~15,000 tokens (text + image) × 2 irises = 30,000 tokens
- Output: ~4,000 tokens × 2 = 8,000 tokens
- Total per analysis: ~$0.08 - $0.12
- 100 analyses: ~$8-12

**OpenAI GPT-4o Mini:**
- Same token usage
- Total per analysis: ~$0.005 - $0.01
- 100 analyses: ~$0.50-1.00

**Google Gemini Pro:**
- Free tier: 50 requests/day (enough for 6-7 full analyses)
- Paid tier: Very affordable
- 100 analyses: ~$2-5 (or free if within daily limits)

**Google Gemini Flash:**
- Free tier: Higher limits
- Paid tier: Very cheap
- 100 analyses: ~$1-2

## Troubleshooting

### Error: "Липсва API ключ" (Missing API Key)
**Solution**: Make sure you've:
- Entered the API key in Admin panel
- Checked "Use Custom Key"
- Saved the configuration
- Refreshed the page

### Error: "Rate limit достигнат" (Rate limit reached)
**Solutions**:
- **For OpenAI**: Wait 5-10 minutes or upgrade tier
- **For Gemini**: Use paid tier or wait for daily reset
- Increase "Request Delay" in Admin panel

### Error: "Invalid API key"
**Solutions**:
- Check that key is copied correctly (no spaces)
- Verify key is not expired or revoked
- For OpenAI: Make sure you have credits
- For Gemini: Check API key is enabled

### Images not analyzed properly
**Check**:
- Model supports vision (must be GPT-4o, GPT-4o-mini, Gemini 1.5 Pro/Flash)
- NOT using older models (GPT-4, GPT-3.5-turbo won't work)
- Logs show "с изображение" (with image)

### Poor quality results
**Try**:
- Switch to higher quality model (GPT-4o or Gemini Pro)
- Check image quality (should be clear, well-lit)
- Verify overlay is visible in composite image

## Performance Comparison

| Model | Speed | Accuracy | Cost | Best Use Case |
|-------|-------|----------|------|---------------|
| GPT-4o | ★★★☆ | ★★★★★ | $$$ | Professional, detailed analysis |
| GPT-4o Mini | ★★★★ | ★★★★☆ | $$ | Regular use, good balance |
| Gemini 1.5 Pro | ★★★☆ | ★★★★☆ | $ | Testing, budget-friendly |
| Gemini 1.5 Flash | ★★★★★ | ★★★☆ | $ | High volume, quick results |

## Recommendations by Use Case

### For Professional Iridology Practice:
- **Primary**: GPT-4o (highest accuracy)
- **Backup**: Gemini 1.5 Pro (if budget concern)
- **Volume**: GPT-4o Mini (if doing many analyses)

### For Personal/Learning Use:
- **Start with**: Gemini 1.5 Pro (free tier)
- **Upgrade to**: GPT-4o Mini (if you like it)

### For Development/Testing:
- **Best choice**: Gemini 1.5 Flash (fast, cheap)
- **Alternative**: GPT-4o Mini (if testing OpenAI)

## Support

If you encounter issues:
1. Check the logs (Покажи логове button)
2. Verify API key is valid
3. Check model name is correct
4. Review error messages
5. Consult OVERLAY_MAP_FIX_SUMMARY.md for technical details

---

**Last Updated**: 2025-01-21  
**Version**: 1.0  
**Compatible with**: AIRIS 1.0+ (with vision support)
