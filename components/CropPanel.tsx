/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState } from 'react';

interface CropPanelProps {
  onApplyCrop: () => void;
  onSetAspect: (aspect: number | undefined) => void;
  isLoading: boolean;
  isCropping: boolean;
}

type AspectRatio = '自由' | '1:1' | '16:9';

const CropPanel: React.FC<CropPanelProps> = ({ onApplyCrop, onSetAspect, isLoading, isCropping }) => {
  const [activeAspect, setActiveAspect] = useState<AspectRatio>('自由');
  
  const handleAspectChange = (aspect: AspectRatio, value: number | undefined) => {
    setActiveAspect(aspect);
    onSetAspect(value);
  }

  const aspects: { name: AspectRatio, value: number | undefined }[] = [
    { name: '自由', value: undefined },
    { name: '1:1', value: 1 / 1 },
    { name: '16:9', value: 16 / 9 },
  ];

  return (
    <div className="w-full bg-white/70 border border-gray-200/80 rounded-xl p-4 flex flex-col items-center gap-4 animate-fade-in backdrop-blur-lg shadow-lg">
      <h3 className="text-lg font-semibold text-gray-900">画像の切り抜き</h3>
      <p className="text-sm text-gray-600 -mt-2">画像上をドラッグして切り抜き範囲を選択します。</p>
      
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600">アスペクト比:</span>
        {aspects.map(({ name, value }) => (
          <button
            key={name}
            onClick={() => handleAspectChange(name, value)}
            disabled={isLoading}
            className={`px-4 py-2 rounded-md text-base font-semibold transition-all duration-200 active:scale-95 disabled:opacity-50 ${
              activeAspect === name 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
              : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
            }`}
          >
            {name}
          </button>
        ))}
      </div>

      <button
        onClick={onApplyCrop}
        disabled={isLoading || !isCropping}
        className="w-full max-w-xs mt-2 bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-lg transition-all duration-300 ease-in-out shadow-lg shadow-green-500/20 hover:shadow-xl hover:shadow-green-500/30 hover:-translate-y-px active:scale-95 active:shadow-inner text-base disabled:bg-green-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
      >
        切り抜きを適用
      </button>
    </div>
  );
};

export default CropPanel;