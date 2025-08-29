/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

// Helper function to convert a File object to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const result = reader.result as string;
            // remove the "data:mime/type;base64," part
            resolve(result.split(',')[1]);
        };
        reader.onerror = error => reject(error);
    });
};


const contextMap: { [key: string]: string } = {
    edit: '編集',
    filter: 'フィルター',
    adjustment: '調整',
    upscale: '高画質化',
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `リクエストがブロックされました。理由: ${blockReason}。${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const translatedContext = contextMap[context] || context;
        const errorMessage = `${translatedContext}の画像生成が予期せず停止しました。理由: ${finishReason}。これはセーフティ設定に関連することがよくあります。`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const translatedContext = contextMap[context] || context;
    const errorMessage = `AIモデルが${translatedContext}の画像を返しませんでした。` + 
        (textFeedback 
            ? `モデルはテキストで応答しました: "${textFeedback}"`
            : "これはセーフティフィルターや、リクエストが複雑すぎる場合に発生する可能性があります。より直接的な表現でプロンプトを書き直してみてください。");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an edited image using generative AI based on a text prompt and a specific point.
 * @param originalImage The original image file.
 * @param userPrompt The text prompt describing the desired edit.
 * @param hotspot The {x, y} coordinates on the image to focus the edit.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateEditedImage = async (
    originalImage: File,
    userPrompt: string,
    hotspot: { x: number, y: number }
): Promise<string> => {
    console.log('Starting generative edit at:', hotspot);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, localized edit on the provided image based on the user's request.
User Request: "${userPrompt}"
Edit Location: Focus on the area around pixel coordinates (x: ${hotspot.x}, y: ${hotspot.y}).

Editing Guidelines:
- The edit must be realistic and blend seamlessly with the surrounding area.
- The rest of the image (outside the immediate edit area) must remain identical to the original.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model.', response);

    return handleApiResponse(response, 'edit');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Generates an image from a text prompt.
 */
export const generateImage = async (
    prompt: string,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4',
): Promise<string> => {
    console.log(`Starting image generation with prompt: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    try {
        const response = await ai.models.generateImages({
            model: 'imagen-4.0-generate-001',
            prompt: prompt,
            config: {
              numberOfImages: 1,
              outputMimeType: 'image/png',
              aspectRatio: aspectRatio,
            },
        });

        if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image.imageBytes) {
            const base64ImageBytes = response.generatedImages[0].image.imageBytes;
            return `data:image/png;base64,${base64ImageBytes}`;
        } else {
            throw new Error('AIモデルが画像を生成できませんでした。プロンプトを変更して再試行してください。');
        }

    } catch(err) {
        console.error('Image generation failed:', err);
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        throw new Error(`画像生成に失敗しました: ${errorMessage}`);
    }
};

/**
 * Enhances a user's prompt for better image generation results.
 */
export const enhancePrompt = async (
    userPrompt: string
): Promise<string> => {
    console.log(`Enhancing prompt: ${userPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const prompt = `You are a world-class prompt engineer specializing in creating vivid, detailed, and effective prompts for generative AI image models. Your task is to take a user's simple idea and expand it into a rich, masterpiece-level prompt.

Follow these rules:
1.  **Analyze Intent:** Understand the core subject and mood the user wants.
2.  **Add Detail:** Elaborate on the subject, background, and environment. Describe textures, materials, and specific features.
3.  **Define Atmosphere:** Specify the lighting (e.g., "dramatic studio lighting," "golden hour glow," "moody cinematic lighting"), time of day, and weather.
4.  **Specify Style:** Define the artistic style (e.g., "photorealistic," "fantasy concept art," "impressionist painting," "cyberpunk anime").
5.  **Set Composition:** Suggest a camera angle, shot type, and lens (e.g., "dynamic low-angle shot," "macro detail shot," "wide-angle panoramic view, 35mm lens").
6.  **Use Strong Keywords:** Use evocative adjectives and technical terms relevant to art and photography.
7.  **Output Format:** Return ONLY the final, enhanced prompt as a single, continuous line of text. Do not add any conversational text, labels, or explanations.

User's idea: "${userPrompt}"`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const enhancedPrompt = response.text.trim();
        if (!enhancedPrompt) {
            throw new Error('モデルがプロンプトを改善できませんでした。');
        }
        return enhancedPrompt;
    } catch (err) {
        console.error('Prompt enhancement failed:', err);
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        throw new Error(`プロンプトの改善に失敗しました: ${errorMessage}`);
    }
};

/**
 * Upscales an image to a higher quality using generative AI.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the upscaled image.
 */
export const upscaleImage = async (
    originalImage: File,
): Promise<string> => {
    console.log(`Starting image upscaling...`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo restoration AI. Your task is to upscale the provided image, significantly increasing its resolution, sharpness, and detail. Remove any compression artifacts, noise, or blurriness. The final result should be a photorealistic, high-quality version of the original. Do not change the composition, content, or style. Output ONLY the final upscaled image.`;
    const textPart = { text: prompt };

    console.log('Sending image and upscale prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
    });
    console.log('Received response from model for upscaling.', response);
    
    return handleApiResponse(response, 'upscale');
};

/**
 * Generates a video from a text prompt and an optional image.
 */
export const generateVideo = async (
    prompt: string,
    image?: File
): Promise<string> => {
    console.log(`Starting video generation with prompt: ${prompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
    const requestPayload: {
        model: string;
        prompt: string;
        image?: { imageBytes: string; mimeType: string; };
        config: { numberOfVideos: number; };
    } = {
        model: 'veo-2.0-generate-001',
        prompt: prompt,
        config: {
            numberOfVideos: 1
        }
    };
    
    if (image) {
        requestPayload.image = {
            imageBytes: await fileToBase64(image),
            mimeType: image.type,
        };
    }

    try {
        let operation = await ai.models.generateVideos(requestPayload);
        
        console.log('Video generation operation started:', operation);

        while (!operation.done) {
            // Wait for 10 seconds before polling again
            await new Promise(resolve => setTimeout(resolve, 10000));
            console.log('Polling for video generation status...');
            operation = await ai.operations.getVideosOperation({ operation: operation });
            console.log('Current operation status:', operation);
        }

        console.log('Video generation operation finished.', operation);

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error('動画の生成に成功しましたが、ビデオデータが見つかりませんでした。セーフティ設定が原因である可能性があります。');
        }

        // The download link requires the API key to be appended
        const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        
        if (!response.ok) {
            throw new Error(`生成された動画のダウンロードに失敗しました: ${response.statusText}`);
        }

        const videoBlob = await response.blob();
        return URL.createObjectURL(videoBlob);

    } catch(err) {
        console.error('Video generation failed:', err);
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        throw new Error(`動画生成に失敗しました: ${errorMessage}`);
    }
};