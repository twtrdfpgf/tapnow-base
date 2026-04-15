import type { ModelConfig } from "../types";
import { fetchThirdParty, constructUrl } from "../network";

// Suno 音频生成处理器
export const SunoHandler = {
    rules: { durations: ['30s', '60s', '120s'], styles: ['pop', 'rock', 'electronic', 'jazz', 'classical', 'folk', 'rap', 'ambient'] },
    generate: async (cfg: ModelConfig, prompt: string, params: any) => {
        const { duration = '30s', style = 'pop' } = params;

        // Suno API 调用
        const payload = {
            prompt: prompt,
            duration: duration,
            style: style
        };

        // 尝试 Suno API
        let url = constructUrl(cfg.baseUrl, cfg.endpoint || '/v1/audio/generate');

        console.log('[Suno] Request URL:', url);
        console.log('[Suno] Payload:', JSON.stringify(payload, null, 2));

        try {
            const res = await fetchThirdParty(url, 'POST', payload, cfg, { timeout: 120000 });

            console.log('[Suno] Response:', JSON.stringify(res, null, 2));

            // 根据不同 API 响应格式提取音频 URL
            let audioUrl = res.audio_url || res.audio || res.url || res.result?.audio_url;

            if (Array.isArray(res.data) && res.data.length > 0) {
                audioUrl = res.data[0].audio_url || res.data[0].url;
            }
            if (Array.isArray(res.audios) && res.audios.length > 0) {
                audioUrl = res.audios[0].audio_url;
            }
            if (res.choices && res.choices.length > 0) {
                audioUrl = res.choices[0].message?.audio_url || res.choices[0].audio?.url;
            }

            if (!audioUrl) {
                throw new Error('No audio URL returned from Suno API');
            }

            return audioUrl;
        } catch (e) {
            console.error('[Suno] Error:', e);
            throw e;
        }
    }
};

// 通用的 Chat-based 音频生成（用于其他音乐 API）
const generateChatAudio = async (config: ModelConfig, prompt: string, params: any) => {
    const { duration = '30s' } = params;

    // 转换为更长的提示词
    const enhancedPrompt = `Generate music: ${prompt}. Duration: ${duration}. Style: ${params.style || 'pop'}.`;

    const messages = [{ role: 'user', content: enhancedPrompt }];
    const payload = { model: config.modelId, messages, stream: false };
    const url = constructUrl(config.baseUrl, config.endpoint);

    const res = await fetchThirdParty(url, 'POST', payload, config, { timeout: 120000 });

    // 尝试从响应中提取音频 URL
    let audioUrl = res.audio_url || res.audio || res.url || res.result?.audio_url;

    if (res.choices && res.choices.length > 0) {
        const content = res.choices[0].message?.content;
        // 尝试从内容中提取 URL
        const urlMatch = content?.match(/https?:\/\/[^\s]+\.(mp3|wav|ogg|m4a)/i);
        if (urlMatch) {
            audioUrl = urlMatch[0];
        }
    }

    if (!audioUrl) {
        throw new Error('No audio URL returned from audio API');
    }

    return audioUrl;
};

export const ChatAudioHandler = {
    rules: { durations: ['30s', '60s', '120s'], styles: ['pop', 'rock', 'electronic', 'jazz', 'classical', 'folk', 'rap', 'ambient'] },
    generate: generateChatAudio
};

export const AUDIO_HANDLERS: Record<string, any> = {
    'Suno': SunoHandler,
    'Suno 3.5': SunoHandler,
    'Chat Audio': ChatAudioHandler
};
