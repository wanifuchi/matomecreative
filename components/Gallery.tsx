/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect, useCallback } from 'react';
import { getAllItemsFromGallery, deleteItemFromGallery, type SavedItem } from '../services/db';
import { TrashIcon, PencilIcon, DownloadIcon, VideoIcon } from './icons';
import Spinner from './Spinner';

interface GalleryProps {
    onNavigateToEditor: (file?: File) => void;
}

const Gallery: React.FC<GalleryProps> = ({ onNavigateToEditor }) => {
    const [items, setItems] = useState<SavedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadItems = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const savedItems = await getAllItemsFromGallery();
            setItems(savedItems);
        } catch (err) {
            console.error("Failed to load items from gallery", err);
            setError("ギャラリーからアイテムの読み込みに失敗しました。");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadItems();
    }, [loadItems]);

    const handleDelete = async (id: number) => {
        if (window.confirm("このアイテムをギャラリーから削除してもよろしいですか？この操作は元に戻せません。")) {
            try {
                await deleteItemFromGallery(id);
                setItems(prevItems => prevItems.filter(item => item.id !== id));
            } catch (err) {
                console.error("Failed to delete item", err);
                setError("アイテムの削除に失敗しました。");
            }
        }
    };

    const handleEdit = (file: File) => {
        onNavigateToEditor(file);
    };

    const handleDownload = (file: File) => {
        const url = URL.createObjectURL(file);
        const link = document.createElement('a');
        link.href = url;
        const extension = file.type.startsWith('video/') ? 'mp4' : 'png';
        link.download = `gallery-${file.name || `item.${extension}`}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const MediaCard: React.FC<{ item: SavedItem }> = ({ item }) => {
        const [mediaUrl, setMediaUrl] = useState<string | null>(null);
        const videoRef = React.useRef<HTMLVideoElement>(null);

        useEffect(() => {
            const url = URL.createObjectURL(item.file);
            setMediaUrl(url);
            return () => URL.revokeObjectURL(url);
        }, [item.file]);

        if (!mediaUrl) return null;

        const isVideo = item.file.type.startsWith('video/');
        
        const handleMouseEnter = () => {
            if (videoRef.current) {
                videoRef.current.play().catch(e => console.error("Video play failed", e));
            }
        }

        const handleMouseLeave = () => {
            if (videoRef.current) {
                videoRef.current.pause();
            }
        }

        return (
            <div 
                className="group relative aspect-square bg-gray-200 rounded-lg overflow-hidden shadow-lg transition-transform duration-300 hover:scale-105"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {isVideo ? (
                     <video ref={videoRef} src={mediaUrl} className="w-full h-full object-cover" loop muted playsInline />
                ) : (
                    <img src={mediaUrl} alt={`Saved on ${item.createdAt.toLocaleString()}`} className="w-full h-full object-cover" />
                )}
                
                {isVideo && (
                    <div className="absolute top-2 right-2 bg-black/50 rounded-full p-1.5 pointer-events-none">
                        <VideoIcon className="w-4 h-4 text-white" />
                    </div>
                )}

                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4">
                    <p className="text-xs text-white mb-auto truncate">{new Date(item.createdAt).toLocaleString()}</p>
                    <div className="flex justify-center items-center gap-3">
                        <button 
                            onClick={() => handleEdit(item.file)} 
                            className="p-3 bg-blue-600 rounded-full text-white hover:bg-blue-500 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed" 
                            aria-label="編集"
                            disabled={isVideo}
                        >
                            <PencilIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDownload(item.file)} className="p-3 bg-green-600 rounded-full text-white hover:bg-green-500 transition-colors" aria-label="ダウンロード">
                            <DownloadIcon className="w-5 h-5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)} className="p-3 bg-red-600 rounded-full text-white hover:bg-red-500 transition-colors" aria-label="削除">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-full"><Spinner /></div>;
    }

    if (error) {
        return <div className="text-center text-red-500">{error}</div>;
    }

    return (
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center gap-6 animate-fade-in p-4 md:p-8">
            <div className="text-center">
                <h2 className="text-4xl font-bold text-gray-900">保存されたメディアギャラリー</h2>
                <p className="text-gray-600 mt-2">ここで保存した画像や動画を確認、編集、または削除できます。</p>
            </div>
            
            {items.length === 0 ? (
                <div className="text-center bg-gray-100 p-10 rounded-lg mt-8 border border-gray-200">
                    <p className="text-xl text-gray-700">ギャラリーは空です。</p>
                    <p className="text-gray-500 mt-2">エディターでアイテムを保存すると、ここに表示されます。</p>
                    <button 
                        onClick={() => onNavigateToEditor()}
                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                    >
                        エディターに戻る
                    </button>
                </div>
            ) : (
                <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {items.map(item => (
                        <MediaCard key={item.id} item={item} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default Gallery;