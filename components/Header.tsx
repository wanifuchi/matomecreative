/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { GalleryIcon, SparkleIcon } from './icons';

interface HeaderProps {
    onNavigateToGallery: () => void;
}

const Header: React.FC<HeaderProps> = ({ onNavigateToGallery }) => {
  return (
    <header className="w-full py-4 px-8 border-b border-gray-200 bg-white/80 backdrop-blur-lg sticky top-0 z-50 flex items-center justify-between">
      <div className="flex items-center gap-3">
          <SparkleIcon className="w-6 h-6 text-blue-600" />
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            matome creative
          </h1>
      </div>
      <button 
          onClick={onNavigateToGallery}
          className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg transition-colors"
          aria-label="ギャラリーを開く"
      >
          <GalleryIcon className="w-5 h-5" />
          ギャラリー
      </button>
    </header>
  );
};

export default Header;