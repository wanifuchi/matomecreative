/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect } from 'react';
import { UploadIcon, MagicWandIcon, VideoIcon, PencilIcon } from './icons';
import { generateImage, enhancePrompt, generateVideo } from '../services/geminiService';
import Spinner from './Spinner';
import { dataURLtoFile } from '../App';
import { saveItemToGallery } from '../services/db';


type AspectRatio = '1:1' | '16:9' | '9:16' | '4:3' | '3:4';

const ImageGenerationPanel: React.FC<{
    onImageGenerated: (file: File) => void;
    onError: (message: string) => void;
    setToastMessage: (message: string) => void;
}> = ({ onImageGenerated, onError, setToastMessage }) => {
    const [prompt, setPrompt] = useState('');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);

    const handleEnhancePrompt = async () => {
        if (!prompt.trim()) {
            onError('改善するプロンプトを入力してください。');
            return;
        }
        setIsEnhancing(true);
        onError(''); 
        try {
            const enhanced = await enhancePrompt(prompt);
            setPrompt(enhanced);
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラー';
            onError(message);
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            onError('画像を生成するためのプロンプトを入力してください。');
            return;
        }
        setIsGenerating(true);
        onError('');
        try {
            const imageUrl = await generateImage(prompt, aspectRatio);
            const imageFile = dataURLtoFile(imageUrl, `generated-${Date.now()}.png`);
            
            try {
                await saveItemToGallery(imageFile);
                setToastMessage("AIが生成した画像をギャラリーに自動保存しました。");
            } catch (saveError) {
                console.error("Failed to auto-save generated image:", saveError);
            }

            onImageGenerated(imageFile);
        // Fix: Corrected invalid `catch (err) =>` syntax to `catch (err)`.
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラー';
            onError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    const aspects: { name: string, value: AspectRatio }[] = [
        { name: '正方形 (1:1)', value: '1:1' },
        { name: '横長 (16:9)', value: '16:9' },
        { name: '縦長 (9:16)', value: '9:16' },
        { name: '標準 (4:3)', value: '4:3' },
        { name: 'ポートレート (3:4)', value: '3:4' },
    ];

    return (
        <div className="w-full max-w-3xl mx-auto text-center p-8 flex flex-col items-center gap-6 animate-fade-in">
             <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
                アイデアを<span className="text-blue-600">画像に</span>変換
            </h1>
            <p className="max-w-2xl text-lg text-gray-600">
                作りたい画像のイメージを文章で説明してください。AIがあなたの言葉から画像を生成します。
            </p>
            
            <form onSubmit={handleGenerate} className="w-full flex flex-col gap-5">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例: 宇宙を旅する猫、サイバーパンクな都市の風景、水彩画風の森..."
                    className="w-full h-32 bg-white border border-gray-300 text-gray-900 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none disabled:opacity-60"
                    disabled={isGenerating || isEnhancing}
                />

                <div className="flex flex-col items-center gap-3">
                    <span className="text-sm font-medium text-gray-600">アスペクト比を選択:</span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {aspects.map(({ name, value }) => (
                            <button
                                type="button"
                                key={name}
                                onClick={() => setAspectRatio(value)}
                                disabled={isGenerating || isEnhancing}
                                className={`px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
                                aspectRatio === value
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                                }`}
                            >
                                {name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                     <button
                        type="button"
                        onClick={handleEnhancePrompt}
                        disabled={isGenerating || isEnhancing || !prompt.trim()}
                        className="flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isEnhancing ? <Spinner className="h-5 w-5 text-gray-700" /> : <><MagicWandIcon className="w-5 h-5 mr-2" /> プロンプトを改善</>}
                    </button>
                    <button
                        type="submit"
                        disabled={isGenerating || isEnhancing || !prompt.trim()}
                        className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:bg-green-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isGenerating ? <Spinner className="h-5 w-5 text-white" /> : '画像を生成'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const VideoProcessingView: React.FC<{ message: string }> = ({ message }) => (
    <div className="w-full max-w-3xl mx-auto text-center p-8 flex flex-col items-center justify-center gap-6 animate-fade-in min-h-[500px]">
        <Spinner />
        <h2 className="text-3xl font-bold text-gray-900">動画を生成中...</h2>
        <p className="text-lg text-gray-600">{message}</p>
    </div>
);

const processingMessages = [
    '創造エンジンを初期化中...',
    'ビジョンを絵コンテに変換しています...',
    '色彩のパレットを準備中...',
    'AIがピクセルを一つ一つ配置しています...',
    'デジタルな夢を紡いでいます...',
    '時間の流れを映像に焼き付けています...',
    'フレームをレンダリング中...これには数分かかることがあります。',
    '創造的な火花が散っています！',
    '魔法の仕上げを適用中...もうすぐです！'
];

const VideoGenerationPanel: React.FC<{
    onError: (message: string) => void;
    setToastMessage: (message: string) => void;
}> = ({ onError, setToastMessage }) => {
    const [prompt, setPrompt] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [processingMessage, setProcessingMessage] = useState(processingMessages[0]);
    const messageIntervalRef = React.useRef<number | null>(null);
    
    useEffect(() => {
        if (isGenerating) {
            messageIntervalRef.current = window.setInterval(() => {
                setProcessingMessage(prev => {
                    const currentIndex = processingMessages.indexOf(prev);
                    const nextIndex = (currentIndex + 1) % processingMessages.length;
                    return processingMessages[nextIndex];
                });
            }, 4000);
        } else {
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
                messageIntervalRef.current = null;
            }
        }
        return () => {
            if (messageIntervalRef.current) {
                clearInterval(messageIntervalRef.current);
            }
        };
    }, [isGenerating]);
    
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleEnhancePrompt = async () => {
        if (!prompt.trim()) {
            onError('改善するプロンプトを入力してください。');
            return;
        }
        setIsEnhancing(true);
        onError('');
        try {
            const enhanced = await enhancePrompt(prompt);
            setPrompt(enhanced);
        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラー';
            onError(message);
        } finally {
            setIsEnhancing(false);
        }
    };
    
    const handleGenerateVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            onError('動画を生成するためのプロンプトを入力してください。');
            return;
        }
        setIsGenerating(true);
        setGeneratedVideoUrl(null);
        onError('');
        try {
            const videoUrl = await generateVideo(prompt, imageFile || undefined);
            setGeneratedVideoUrl(videoUrl);
            
            // Auto-save the generated video to the gallery
            try {
                const response = await fetch(videoUrl);
                const videoBlob = await response.blob();
                const videoFile = new File([videoBlob], `generated-video-${Date.now()}.mp4`, { type: 'video/mp4' });
                await saveItemToGallery(videoFile);
                setToastMessage("AIが生成した動画をギャラリーに自動保存しました。");
            } catch (saveError) {
                // Non-critical error, log it but don't bother the user with a full error screen.
                console.error("Failed to auto-save generated video to gallery:", saveError);
            }

        } catch (err) {
            const message = err instanceof Error ? err.message : '不明なエラー';
            onError(message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleStartOver = () => {
        if (generatedVideoUrl) {
            URL.revokeObjectURL(generatedVideoUrl);
        }
        setPrompt('');
        setImageFile(null);
        setImagePreview(null);
        setGeneratedVideoUrl(null);
        setIsGenerating(false);
        onError('');
    };
    
    if (isGenerating) {
        return <VideoProcessingView message={processingMessage} />;
    }

    if (generatedVideoUrl) {
        return (
            <div className="w-full max-w-3xl mx-auto text-center p-8 flex flex-col items-center gap-6 animate-fade-in">
                <h1 className="text-4xl font-bold text-gray-900">動画が完成しました！</h1>
                <video src={generatedVideoUrl} controls autoPlay loop className="w-full rounded-lg shadow-xl" />
                <div className="flex items-center gap-4 mt-4">
                    <a 
                        href={generatedVideoUrl} 
                        download={`generated-video-${Date.now()}.mp4`}
                        className="inline-block bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                        ダウンロード
                    </a>
                    <button onClick={handleStartOver} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                        もう一度生成する
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-3xl mx-auto text-center p-8 flex flex-col items-center gap-6 animate-fade-in">
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl">
                アイデアを<span className="text-indigo-600">動画に</span>変換
            </h1>
            <p className="max-w-2xl text-lg text-gray-600">
                テキストや画像から、AIがユニークな動画を生成します。
            </p>
            
            <form onSubmit={handleGenerateVideo} className="w-full flex flex-col gap-5">
                <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="例: 夕暮れのビーチを歩くロボット、未来都市を飛ぶドローン..."
                    className="w-full h-32 bg-white border border-gray-300 text-gray-900 rounded-lg p-5 text-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none transition resize-none disabled:opacity-60"
                    disabled={isGenerating || isEnhancing}
                />
                 <div className="w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center">
                    {imagePreview ? (
                        <div className="relative group">
                            <img src={imagePreview} alt="Image preview" className="max-h-40 mx-auto rounded-md" />
                            <button 
                                onClick={() => { setImageFile(null); setImagePreview(null); }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="画像を削除"
                                disabled={isGenerating || isEnhancing}
                            >
                                &#x2715;
                            </button>
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="video-image-upload" className={`font-semibold transition-colors ${isGenerating || isEnhancing ? 'text-gray-400 cursor-not-allowed' : 'cursor-pointer text-indigo-600 hover:text-indigo-800'}`}>
                                画像をアップロード
                            </label>
                            <input id="video-image-upload" type="file" className="hidden" accept="image/*" onChange={handleImageChange} disabled={isGenerating || isEnhancing} />
                            <p className="text-xs text-gray-500 mt-1">（オプション）動画の基にする画像を選択</p>
                        </div>
                    )}
                </div>
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <button
                        type="button"
                        onClick={handleEnhancePrompt}
                        disabled={isGenerating || isEnhancing || !prompt.trim()}
                        className="flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-lg transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isEnhancing ? <Spinner className="h-5 w-5 text-gray-700" /> : <><MagicWandIcon className="w-5 h-5 mr-2" /> プロンプトを改善</>}
                    </button>
                    <button
                        type="submit"
                        disabled={isGenerating || isEnhancing || !prompt.trim()}
                        className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:bg-indigo-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                    >
                        {isGenerating ? <Spinner className="h-5 w-5 text-white" /> : '動画を生成'}
                    </button>
                </div>
            </form>
        </div>
    );
};

const GenerationHub: React.FC<{
    onImageGenerated: (file: File) => void;
    onError: (message: string) => void;
    onSwitchToUpload: () => void;
    setToastMessage: (message: string) => void;
    initialTab?: 'image' | 'video';
}> = ({ onImageGenerated, onError, onSwitchToUpload, setToastMessage, initialTab = 'image' }) => {
    const [activeTab, setActiveTab] = useState<'image' | 'video'>(initialTab);

    return (
        <div className="w-full">
            <div className="w-full max-w-md mx-auto bg-gray-100 rounded-lg p-1 flex items-center justify-center gap-1 mb-6">
                <button
                    onClick={() => setActiveTab('image')}
                    className={`flex-grow capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base flex items-center justify-center gap-2 ${
                        activeTab === 'image' 
                        ? 'bg-white text-gray-900 shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    <MagicWandIcon className="w-5 h-5" /> 画像生成
                </button>
                <button
                    onClick={() => setActiveTab('video')}
                    className={`flex-grow capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base flex items-center justify-center gap-2 ${
                        activeTab === 'video' 
                        ? 'bg-white text-gray-900 shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    <VideoIcon className="w-5 h-5" /> 動画生成
                </button>
            </div>
            
            {activeTab === 'image' ? (
                <ImageGenerationPanel onImageGenerated={onImageGenerated} onError={onError} setToastMessage={setToastMessage} />
            ) : (
                <VideoGenerationPanel onError={onError} setToastMessage={setToastMessage} />
            )}
            
            <button onClick={onSwitchToUpload} className="text-sm text-gray-500 hover:text-blue-600 transition-colors mt-8 mx-auto block">
                または、既存の画像をアップロードして編集
            </button>
        </div>
    );
};

interface StartScreenProps {
  onImageReady: (file: File) => void;
  initialMode: 'upload' | 'generate';
  onError: (message: string) => void;
  setToastMessage: (message: string) => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ onImageReady, initialMode, onError, setToastMessage }) => {
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [mode, setMode] = useState<'upload' | 'generate'>(initialMode);
  const [initialGenerationTab, setInitialGenerationTab] = useState<'image' | 'video'>('image');


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (e.target.files && e.target.files[0]) {
        onImageReady(e.target.files[0]);
    }
  };
  
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        onImageReady(e.dataTransfer.files[0]);
    }
  };

  if (mode === 'generate') {
    return <GenerationHub 
        onImageGenerated={onImageReady} 
        onError={onError} 
        onSwitchToUpload={() => setMode('upload')} 
        setToastMessage={setToastMessage}
        initialTab={initialGenerationTab}
    />;
  }

  return (
    <div 
      className={`w-full max-w-5xl mx-auto text-center p-8 transition-all duration-300 rounded-2xl border-2 ${isDraggingOver ? 'bg-blue-50 border-dashed border-blue-400' : 'border-transparent'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
      onDragLeave={() => setIsDraggingOver(false)}
      onDrop={handleDrop}
    >
      <div className="flex flex-col items-center gap-6 animate-fade-in">
        <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 sm:text-6xl md:text-7xl">
          写真編集とAI生成を、<span className="text-blue-600">シンプルに</span>。
        </h1>
        <p className="max-w-3xl text-lg text-gray-600 md:text-xl">
          簡単なテキスト指示だけで、写真のレタッチから全く新しいアートや動画の生成まで。あなたの創造性を、かつてないほど簡単に解放します。
        </p>

        <div className="mt-6 flex flex-col items-center gap-4">
             <div className="flex flex-wrap items-center justify-center gap-4">
                <label htmlFor="image-upload-start" className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-blue-600 rounded-full cursor-pointer group hover:bg-blue-700 transition-colors">
                    <UploadIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
                    画像をアップロード
                </label>
                <button 
                    onClick={() => {
                        setMode('generate');
                        setInitialGenerationTab('image');
                    }}
                    className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-green-600 rounded-full cursor-pointer group hover:bg-green-700 transition-colors">
                    <MagicWandIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
                    AIで画像を生成
                </button>
                <button 
                    onClick={() => {
                        setMode('generate');
                        setInitialGenerationTab('video');
                    }}
                    className="relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-indigo-600 rounded-full cursor-pointer group hover:bg-indigo-700 transition-colors">
                    <VideoIcon className="w-6 h-6 mr-3 transition-transform duration-500 ease-in-out group-hover:rotate-[360deg] group-hover:scale-110" />
                    AIで動画を生成
                </button>
            </div>
            <input id="image-upload-start" type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
            <p className="text-sm text-gray-500">またはファイルをドラッグ＆ドロップ</p>
        </div>

        <div className="mt-16 w-full">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full mb-4 shadow-sm">
                       <PencilIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">AI写真編集</h3>
                    <p className="mt-2 text-gray-600">簡単なテキスト指示やクリック操作で、不要なオブジェクトの除去、色の変更、背景のぼかしなど、プロレベルの編集が誰でも簡単に行えます。</p>
                </div>
                <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full mb-4 shadow-sm">
                       <MagicWandIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">AI画像生成</h3>
                    <p className="mt-2 text-gray-600">あなたの頭の中にあるイメージを言葉にするだけで、AIがユニークで高品質な画像を生成します。アイデアを瞬時にビジュアル化できます。</p>
                </div>
                <div className="bg-gray-100 p-6 rounded-lg border border-gray-200 flex flex-col items-center text-center">
                    <div className="flex items-center justify-center w-12 h-12 bg-white rounded-full mb-4 shadow-sm">
                       <VideoIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900">AI動画生成</h3>
                    <p className="mt-2 text-gray-600">テキストや一枚の画像から、世界に一つだけのショートビデオを創り出します。SNSコンテンツやコンセプトムービーの制作に最適です。</p>
                </div>
            </div>
        </div>

      </div>
    </div>
  );
};

export default StartScreen;