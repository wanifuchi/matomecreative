/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/


import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactCrop, { type Crop, type PixelCrop } from 'react-image-crop';
import { generateEditedImage, generateFilteredImage, generateAdjustedImage, upscaleImage } from './services/geminiService';
import Header from './components/Header';
import Spinner from './components/Spinner';
import FilterPanel from './components/FilterPanel';
import AdjustmentPanel from './components/AdjustmentPanel';
import CropPanel from './components/CropPanel';
import { UndoIcon, RedoIcon, EyeIcon, BookmarkIcon, DownloadIcon, SparkleIcon } from './components/icons';
import StartScreen from './components/StartScreen';
import Gallery from './components/Gallery';
import { saveItemToGallery } from './services/db';

// Helper to convert a data URL string to a File object
export const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// Helper to convert a File object to a data URL string
const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

// Function to load initial state from localStorage
const loadInitialState = (): { history: File[]; historyIndex: number } => {
    try {
        const savedHistoryJSON = localStorage.getItem('matome_creative_history');
        const savedIndexStr = localStorage.getItem('matome_creative_historyIndex');

        if (!savedHistoryJSON || !savedIndexStr) {
            return { history: [], historyIndex: -1 };
        }
        
        const savedHistory: { dataUrl: string; name: string }[] = JSON.parse(savedHistoryJSON);
        const history = savedHistory.map(item => dataURLtoFile(item.dataUrl, item.name));
        let historyIndex = parseInt(savedIndexStr, 10);
        
        // Validate index. If invalid, default to the last item.
        if (isNaN(historyIndex) || historyIndex < 0 || historyIndex >= history.length) {
            historyIndex = history.length > 0 ? history.length - 1 : -1;
        }

        return { history, historyIndex };
    } catch (error) {
        console.error("Failed to load state from localStorage", error);
        // Clear corrupted data
        localStorage.removeItem('matome_creative_history');
        localStorage.removeItem('matome_creative_historyIndex');
        return { history: [], historyIndex: -1 };
    }
};

const initialState = loadInitialState();

type View = 'editor' | 'gallery';
type Tab = 'retouch' | 'adjust' | 'filters' | 'crop' | 'generate';
const tabNames: Record<Tab, string> = {
  retouch: 'レタッチ',
  adjust: '調整',
  filters: 'フィルター',
  crop: '切り抜き',
  generate: '画像生成'
};

const App: React.FC = () => {
  const [history, setHistory] = useState<File[]>(initialState.history);
  const [historyIndex, setHistoryIndex] = useState<number>(initialState.historyIndex);
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editHotspot, setEditHotspot] = useState<{ x: number, y: number } | null>(null);
  const [displayHotspot, setDisplayHotspot] = useState<{ x: number, y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('retouch');
  
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>();
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [startMode, setStartMode] = useState<'upload' | 'generate'>('upload');
  const [view, setView] = useState<View>('editor');
  const [toastMessage, setToastMessage] = useState<string | null>(null);


  const currentImage = history[historyIndex] ?? null;
  const originalImage = history[0] ?? null;

  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);

  // Effect to save state to localStorage whenever it changes
  useEffect(() => {
    const saveState = async () => {
      try {
        if (history.length > 0 && historyIndex >= 0) {
          const serializableHistory = await Promise.all(
            history.map(async file => ({
              dataUrl: await fileToDataURL(file),
              name: file.name
            }))
          );
          localStorage.setItem('matome_creative_history', JSON.stringify(serializableHistory));
          localStorage.setItem('matome_creative_historyIndex', String(historyIndex));
        } else {
          // Clear localStorage if history is empty or index is invalid
          localStorage.removeItem('matome_creative_history');
          localStorage.removeItem('matome_creative_historyIndex');
        }
      } catch (error) {
        console.error("Failed to save state to localStorage", error);
      }
    };
    saveState();
  }, [history, historyIndex]);

  // Effect for toast messages
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Effect to create and revoke object URLs safely for the current image
  useEffect(() => {
    if (currentImage) {
      const url = URL.createObjectURL(currentImage);
      setCurrentImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCurrentImageUrl(null);
    }
  }, [currentImage]);
  
  // Effect to create and revoke object URLs safely for the original image
  useEffect(() => {
    if (originalImage) {
      const url = URL.createObjectURL(originalImage);
      setOriginalImageUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setOriginalImageUrl(null);
    }
  }, [originalImage]);


  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const addImageToHistory = useCallback((newImageFile: File) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newImageFile);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    // Reset transient states after an action
    setCrop(undefined);
    setCompletedCrop(undefined);
  }, [history, historyIndex]);

  const handleImageUpload = useCallback((file: File) => {
    setError(null);
    setHistory([file]);
    setHistoryIndex(0);
    setEditHotspot(null);
    setDisplayHotspot(null);
    setActiveTab('retouch');
    setCrop(undefined);
    setCompletedCrop(undefined);
    setStartMode('upload');
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!currentImage) {
      setError('編集する画像が読み込まれていません。');
      return;
    }
    
    if (!prompt.trim()) {
        setError('編集内容を入力してください。');
        return;
    }

    if (!editHotspot) {
        setError('編集する領域を画像上でクリックして選択してください。');
        return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
        const editedImageUrl = await generateEditedImage(currentImage, prompt, editHotspot);
        const newImageFile = dataURLtoFile(editedImageUrl, `edited-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setEditHotspot(null);
        setDisplayHotspot(null);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        setError(`画像の生成に失敗しました。 ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, prompt, editHotspot, addImageToHistory]);
  
  const handleApplyFilter = useCallback(async (filterPrompt: string) => {
    if (!currentImage) {
      setError('フィルターを適用する画像が読み込まれていません。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const filteredImageUrl = await generateFilteredImage(currentImage, filterPrompt);
        const newImageFile = dataURLtoFile(filteredImageUrl, `filtered-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        setError(`フィルターの適用に失敗しました。 ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);
  
  const handleApplyAdjustment = useCallback(async (adjustmentPrompt: string) => {
    if (!currentImage) {
      setError('調整を適用する画像が読み込まれていません。');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
        const adjustedImageUrl = await generateAdjustedImage(currentImage, adjustmentPrompt);
        const newImageFile = dataURLtoFile(adjustedImageUrl, `adjusted-${Date.now()}.png`);
        addImageToHistory(newImageFile);
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        setError(`調整の適用に失敗しました。 ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleApplyCrop = useCallback(() => {
    if (!completedCrop || !imgRef.current) {
        setError('切り抜く領域を選択してください。');
        return;
    }

    const image = imgRef.current;
    const canvas = document.createElement('canvas');
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = completedCrop.width;
    canvas.height = completedCrop.height;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        setError('切り抜きを処理できませんでした。');
        return;
    }

    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = completedCrop.width * pixelRatio;
    canvas.height = completedCrop.height * pixelRatio;
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.imageSmoothingQuality = 'high';

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      // Fix: Corrected typo `completed-crop` to `completedCrop`.
      completedCrop.height * scaleY,
      0,
      0,
      completedCrop.width,
      completedCrop.height,
    );
    
    const croppedImageUrl = canvas.toDataURL('image/png');
    const newImageFile = dataURLtoFile(croppedImageUrl, `cropped-${Date.now()}.png`);
    addImageToHistory(newImageFile);

  }, [completedCrop, addImageToHistory]);

  const handleUpscaleImage = useCallback(async () => {
    if (!currentImage) {
      setError('高品質化する画像が読み込まれていません。');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
        const upscaledImageUrl = await upscaleImage(currentImage);
        const newImageFile = dataURLtoFile(upscaledImageUrl, `upscaled-${Date.now()}.png`);
        addImageToHistory(newImageFile);
        setToastMessage("画像を高品質化しました。");
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
        setError(`画像の高品質化に失敗しました。 ${errorMessage}`);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  }, [currentImage, addImageToHistory]);

  const handleUndo = useCallback(() => {
    if (canUndo) {
      setHistoryIndex(historyIndex - 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canUndo, historyIndex]);
  
  const handleRedo = useCallback(() => {
    if (canRedo) {
      setHistoryIndex(historyIndex + 1);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [canRedo, historyIndex]);

  const handleReset = useCallback(() => {
    if (history.length > 0) {
      setHistoryIndex(0);
      setError(null);
      setEditHotspot(null);
      setDisplayHotspot(null);
    }
  }, [history]);

  const handleUploadNew = useCallback((mode: 'upload' | 'generate' = 'upload') => {
      setHistory([]);
      setHistoryIndex(-1);
      setError(null);
      setPrompt('');
      setEditHotspot(null);
      setDisplayHotspot(null);
      setStartMode(mode);
  }, []);

  const handleDownload = useCallback(() => {
      if (currentImage) {
          const link = document.createElement('a');
          link.href = URL.createObjectURL(currentImage);
          link.download = `edited-${currentImage.name}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      }
  }, [currentImage]);

  const handleSaveToGallery = useCallback(async () => {
    if (currentImage) {
        setIsLoading(true);
        setError(null);
        try {
            await saveItemToGallery(currentImage);
            setToastMessage("画像をギャラリーに保存しました。");
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : '不明なエラーが発生しました。';
            setError(`ギャラリーへの保存に失敗しました。 ${errorMessage}`);
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    }
  }, [currentImage]);

  const handleNavigateToGallery = useCallback(() => {
    setView('gallery');
  }, []);

  const handleNavigateToEditor = useCallback((imageFile?: File) => {
    if (imageFile) {
        setError(null);
        setHistory([imageFile]);
        setHistoryIndex(0);
        setEditHotspot(null);
        setDisplayHotspot(null);
        setActiveTab('retouch');
        setCrop(undefined);
        setCompletedCrop(undefined);
    }
    setView('editor');
  }, []);

  const handleImageClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (activeTab !== 'retouch') return;
    
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();

    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDisplayHotspot({ x: offsetX, y: offsetY });

    const { naturalWidth, naturalHeight, clientWidth, clientHeight } = img;
    const scaleX = naturalWidth / clientWidth;
    const scaleY = naturalHeight / clientHeight;

    const originalX = Math.round(offsetX * scaleX);
    const originalY = Math.round(offsetY * scaleY);

    setEditHotspot({ x: originalX, y: originalY });
};

  const renderContent = () => {
    if (error) {
       return (
           <div className="text-center animate-fade-in bg-red-100 border border-red-300 p-8 rounded-lg max-w-2xl mx-auto flex flex-col items-center gap-4">
            <h2 className="text-2xl font-bold text-red-800">エラーが発生しました</h2>
            <p className="text-md text-red-600">{error}</p>
            <button
                onClick={() => setError(null)}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg text-md transition-colors"
              >
                再試行
            </button>
          </div>
        );
    }

    if (view === 'gallery') {
      return <Gallery onNavigateToEditor={handleNavigateToEditor} />;
    }
    
    if (!currentImageUrl) {
      return <StartScreen onImageReady={handleImageUpload} initialMode={startMode} onError={setError} setToastMessage={setToastMessage} />;
    }

    const imageDisplay = (
      <div className="relative">
        {/* Base image is the original, always at the bottom */}
        {originalImageUrl && (
            <img
                key={originalImageUrl}
                src={originalImageUrl}
                alt="Original"
                className="w-full h-auto object-contain max-h-[60vh] rounded-xl pointer-events-none"
            />
        )}
        {/* The current image is an overlay that fades in/out for comparison */}
        <img
            ref={imgRef}
            key={currentImageUrl}
            src={currentImageUrl}
            alt="Current"
            onClick={handleImageClick}
            className={`absolute top-0 left-0 w-full h-auto object-contain max-h-[60vh] rounded-xl transition-opacity duration-200 ease-in-out ${isComparing ? 'opacity-0' : 'opacity-100'} ${activeTab === 'retouch' ? 'cursor-crosshair' : ''}`}
        />
      </div>
    );
    
    // For ReactCrop, we need a single image element. We'll use the current one.
    const cropImageElement = (
      <img 
        ref={imgRef}
        key={`crop-${currentImageUrl}`}
        src={currentImageUrl} 
        alt="Crop this image"
        className="w-full h-auto object-contain max-h-[60vh] rounded-xl"
      />
    );


    return (
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-6 animate-fade-in">
        <div className="relative w-full shadow-xl rounded-xl overflow-hidden bg-gray-200">
            {isLoading && (
                <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-30 flex flex-col items-center justify-center gap-4 animate-fade-in">
                    <Spinner />
                    <p className="text-gray-700">AIが魔法をかけています...</p>
                </div>
            )}
            
            {activeTab === 'crop' ? (
              <ReactCrop 
                crop={crop} 
                onChange={c => setCrop(c)} 
                onComplete={c => setCompletedCrop(c)}
                aspect={aspect}
                className="max-h-[60vh]"
              >
                {cropImageElement}
              </ReactCrop>
            ) : imageDisplay }

            {displayHotspot && !isLoading && activeTab === 'retouch' && (
                <div 
                    className="absolute rounded-full w-6 h-6 bg-blue-500/50 border-2 border-blue-200 pointer-events-none -translate-x-1/2 -translate-y-1/2 z-10"
                    style={{ left: `${displayHotspot.x}px`, top: `${displayHotspot.y}px` }}
                >
                    <div className="absolute inset-0 rounded-full w-6 h-6 animate-ping bg-blue-500"></div>
                </div>
            )}
        </div>
        
        <div className="w-full bg-gray-100 rounded-lg p-1 flex items-center justify-center gap-1">
            {(['retouch', 'crop', 'adjust', 'filters', 'generate'] as Tab[]).map(tab => {
                if (tab === 'generate') {
                  return (
                    <button
                        key={tab}
                        onClick={() => {
                            if (canUndo) {
                                if (window.confirm('現在の編集を破棄して、新しい画像を生成しますか？')) {
                                    handleUploadNew('generate');
                                }
                            } else {
                                handleUploadNew('generate');
                            }
                        }}
                        className={`flex-grow capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base text-gray-500 hover:text-gray-900 hover:bg-gray-200`}
                    >
                        {tabNames[tab]}
                    </button>
                  )
                }
                return (
                 <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-grow capitalize font-semibold py-3 px-5 rounded-md transition-all duration-200 text-base ${
                        activeTab === tab 
                        ? 'bg-white text-gray-900 shadow-md' 
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200'
                    }`}
                >
                    {tabNames[tab]}
                </button>
                )
            })}
        </div>
        
        <div className="w-full">
            {activeTab === 'retouch' && (
                <div className="flex flex-col items-center gap-4">
                    <p className="text-md text-gray-600">
                        {editHotspot ? '素晴らしい！次に、編集内容を以下に記述してください。' : '画像上の編集したい領域をクリックしてください。'}
                    </p>
                    <form onSubmit={(e) => { e.preventDefault(); handleGenerate(); }} className="w-full flex items-center gap-2">
                        <input
                            type="text"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder={editHotspot ? "例: 'シャツの色を青に変えて'" : "まず画像上の点をクリックしてください"}
                            className="flex-grow bg-white border border-gray-300 text-gray-900 rounded-lg p-5 text-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition w-full disabled:cursor-not-allowed disabled:opacity-60"
                            disabled={isLoading || !editHotspot}
                        />
                        <button 
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-5 px-8 text-lg rounded-lg transition-all duration-200 ease-in-out shadow-lg shadow-blue-500/20 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner disabled:bg-blue-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
                            disabled={isLoading || !prompt.trim() || !editHotspot}
                        >
                            生成
                        </button>
                    </form>
                </div>
            )}
            {activeTab === 'crop' && <CropPanel onApplyCrop={handleApplyCrop} onSetAspect={setAspect} isLoading={isLoading} isCropping={!!completedCrop?.width && completedCrop.width > 0} />}
            {activeTab === 'adjust' && <AdjustmentPanel onApplyAdjustment={handleApplyAdjustment} isLoading={isLoading} />}
            {activeTab === 'filters' && <FilterPanel onApplyFilter={handleApplyFilter} isLoading={isLoading} />}
        </div>
        
        <div className="w-full flex flex-wrap items-center justify-center gap-3 mt-6">
            <button 
                onClick={handleUndo}
                disabled={!canUndo}
                className="flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="最後の操作を取り消す"
            >
                <UndoIcon className="w-5 h-5 mr-2" />
                元に戻す
            </button>
            <button 
                onClick={handleRedo}
                disabled={!canRedo}
                className="flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="最後の操作をやり直す"
            >
                <RedoIcon className="w-5 h-5 mr-2" />
                やり直す
            </button>
            
            <div className="h-6 w-px bg-gray-300 mx-1 hidden sm:block"></div>

            {canUndo && (
              <button 
                  onMouseDown={() => setIsComparing(true)}
                  onMouseUp={() => setIsComparing(false)}
                  onMouseLeave={() => setIsComparing(false)}
                  onTouchStart={() => setIsComparing(true)}
                  onTouchEnd={() => setIsComparing(false)}
                  className="flex items-center justify-center text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base"
                  aria-label="長押しで元の画像を表示"
              >
                  <EyeIcon className="w-5 h-5 mr-2" />
                  比較
              </button>
            )}

            <button 
                onClick={handleReset}
                disabled={!canUndo}
                className="text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                リセット
            </button>
            <button 
                onClick={() => handleUploadNew('upload')}
                className="text-center bg-white border border-gray-300 text-gray-700 font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out hover:bg-gray-50 active:scale-95 text-base"
            >
                新規アップロード
            </button>

            <div className="w-px h-6 bg-gray-300 mx-1 hidden sm:block"></div>

            <button 
                onClick={handleUpscaleImage}
                disabled={isLoading || !currentImage}
                className="flex items-center justify-center ml-auto bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-purple-400"
                aria-label="画像を高品質化する"
            >
                <SparkleIcon className="w-5 h-5 mr-2" />
                高画質化
            </button>
            <button 
                onClick={handleSaveToGallery}
                disabled={isLoading}
                className="flex items-center justify-center bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-5 rounded-md transition-all duration-200 ease-in-out active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-indigo-400"
                aria-label="ギャラリーに保存"
            >
                <BookmarkIcon className="w-5 h-5 mr-2" />
                保存
            </button>
            <button 
                onClick={handleDownload}
                className="flex items-center justify-center bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-5 rounded-md transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base"
                aria-label="画像をダウンロード"
            >
                <DownloadIcon className="w-5 h-5 mr-2" />
                ダウンロード
            </button>
        </div>
      </div>
    );
  };

  const renderToast = () => {
    if (!toastMessage) return null;
    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white py-3 px-6 rounded-lg shadow-lg z-50 animate-fade-in">
            {toastMessage}
        </div>
    );
  };
  
  return (
    <div className="min-h-screen text-gray-800 flex flex-col">
      <Header onNavigateToGallery={handleNavigateToGallery} />
      <main className={`flex-grow w-full max-w-[1600px] mx-auto p-4 md:p-8 flex justify-center ${currentImage && view === 'editor' ? 'items-start' : 'items-center'}`}>
        {renderContent()}
      </main>
      {renderToast()}
    </div>
  );
};

export default App;