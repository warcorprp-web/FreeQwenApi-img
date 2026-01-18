// imageGen.js - Генерация изображений через Qwen
import { getBrowserContext } from '../browser/browser.js';
import { getAvailableToken } from './tokenManager.js';
import crypto from 'crypto';
import { logInfo, logError } from '../logger/index.js';

export async function generateImage(prompt, size = '1:1') {
    const context = getBrowserContext();
    if (!context) {
        return { error: 'Browser not initialized' };
    }

    const tokenObj = await getAvailableToken();
    if (!tokenObj?.token) {
        return { error: 'No valid token' };
    }
    const token = tokenObj.token;

    try {
        const page = await context.newPage();
        await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Создаём чат
        const chatRes = await page.evaluate(async (t) => {
            const r = await fetch('https://chat.qwen.ai/api/v2/chats/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
                body: JSON.stringify({ name: 'img' })
            });
            return r.json();
        }, token);

        if (!chatRes.success) {
            await page.close();
            return { error: 'Failed to create chat' };
        }

        const chatId = chatRes.data.id;
        const ts = Math.floor(Date.now() / 1000);
        
        const payload = {
            stream: true, version: '2.1', incremental_output: true,
            chat_id: chatId, chat_mode: 'normal', model: 'qwen3-max-2025-10-30',
            parent_id: null, size, timestamp: ts,
            messages: [{
                fid: crypto.randomUUID(), parentId: null, parent_id: null,
                role: 'user', content: prompt,
                chat_type: 't2i', sub_chat_type: 't2i',
                childrenIds: [crypto.randomUUID()],
                extra: { meta: { subChatType: 't2i' } },
                feature_config: { thinking_enabled: false, output_schema: 'phase', research_mode: 'advance' },
                files: [], models: ['qwen3-max-2025-10-30'], user_action: 'chat', timestamp: ts
            }]
        };

        // Генерируем
        const result = await page.evaluate(async (data) => {
            const r = await fetch('https://chat.qwen.ai/api/v2/chat/completions?chat_id=' + data.chatId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.token },
                body: JSON.stringify(data.payload)
            });
            return r.text();
        }, { chatId, token, payload });

        // Парсим URL
        let imageUrl = null;
        for (const line of result.split('\n')) {
            if (line.includes('cdn.qwenlm.ai')) {
                try {
                    const json = JSON.parse(line.replace('data: ', ''));
                    imageUrl = json.choices[0].delta.content;
                    break;
                } catch {}
            }
        }

        if (!imageUrl) {
            await page.close();
            return { error: 'No image URL in response' };
        }

        logInfo(`Image generated: ${imageUrl.substring(0, 80)}...`);

        // Скачиваем картинку
        const response = await page.goto(imageUrl, { waitUntil: 'load' });
        const buffer = await response.body();
        await page.close();

        return { url: imageUrl, buffer };
    } catch (error) {
        logError('Image generation error', error);
        return { error: error.message };
    }
}

export async function composeImages(imageUrls, prompt) {
    const context = getBrowserContext();
    if (!context) {
        return { error: 'Browser not initialized' };
    }

    const tokenObj = await getAvailableToken();
    if (!tokenObj?.token) {
        return { error: 'No valid token' };
    }
    const token = tokenObj.token;

    try {
        const page = await context.newPage();
        await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });

        // Создаём чат
        const chatRes = await page.evaluate(async (t) => {
            const r = await fetch('https://chat.qwen.ai/api/v2/chats/new', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + t },
                body: JSON.stringify({ name: 'compose' })
            });
            return r.json();
        }, token);

        if (!chatRes.success) {
            await page.close();
            return { error: 'Failed to create chat' };
        }

        const chatId = chatRes.data.id;
        const ts = Math.floor(Date.now() / 1000);
        
        // Формируем files массив точно как в оригинальном запросе
        const files = imageUrls.map((url, i) => ({
            type: 'image',
            file: {
                created_at: Date.now(),
                data: {},
                filename: `image${i + 1}.png`,
                hash: null,
                id: crypto.randomUUID(),
                user_id: tokenObj.id,
                meta: {
                    name: `image${i + 1}.png`,
                    size: 100000,
                    content_type: 'image/png'
                },
                update_at: Date.now()
            },
            id: crypto.randomUUID(),
            url,
            name: `image${i + 1}.png`,
            collection_name: '',
            progress: 0,
            status: 'uploaded',
            greenNet: 'success',
            size: 100000,
            error: '',
            itemId: crypto.randomUUID(),
            file_type: 'image/png',
            showType: 'image',
            file_class: 'vision',
            uploadTaskId: crypto.randomUUID()
        }));

        const payload = {
            stream: true,
            version: '2.1',
            incremental_output: true,
            chat_id: chatId,
            chat_mode: 'normal',
            model: 'qwen3-max-2025-09-23',
            parent_id: null,
            messages: [{
                fid: crypto.randomUUID(),
                parentId: null,
                childrenIds: [crypto.randomUUID()],
                role: 'user',
                content: prompt,
                user_action: 'chat',
                files,
                timestamp: ts,
                models: ['qwen3-max-2025-09-23'],
                chat_type: 'image_edit',
                feature_config: {
                    thinking_enabled: false,
                    output_schema: 'phase',
                    research_mode: 'normal'
                },
                extra: {
                    meta: {
                        subChatType: 'image_edit'
                    }
                },
                sub_chat_type: 'image_edit',
                parent_id: null
            }],
            timestamp: ts
        };

        // Отправляем запрос
        const result = await page.evaluate(async (data) => {
            const r = await fetch('https://chat.qwen.ai/api/v2/chat/completions?chat_id=' + data.chatId, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + data.token },
                body: JSON.stringify(data.payload)
            });
            return r.text();
        }, { chatId, token, payload });

        logInfo(`Response from Qwen: ${result.substring(0, 500)}...`);

        // Парсим URL результата
        let imageUrl = null;
        for (const line of result.split('\n')) {
            if (line.includes('cdn.qwenlm.ai') || line.includes('http')) {
                try {
                    const json = JSON.parse(line.replace('data: ', ''));
                    const content = json.choices?.[0]?.delta?.content;
                    if (content && (content.includes('http') || content.includes('cdn'))) {
                        imageUrl = content;
                        break;
                    }
                } catch {}
            }
        }

        if (!imageUrl) {
            await page.close();
            return { error: 'No image URL in response', debug: result.substring(0, 1000) };
        }

        logInfo(`Images composed: ${imageUrl.substring(0, 80)}...`);
        await page.close();

        return { url: imageUrl, success: true };
    } catch (error) {
        logError('Image composition error', error);
        return { error: error.message };
    }
}
