'use client';

import { useState, useRef } from 'react';
import { Upload, X } from 'lucide-react';

interface CosUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onDurationChange?: (duration: number) => void;
}

export default function CosUploader({ value, onChange, onDurationChange }: CosUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 获取音频时长
  const getAudioDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const audio = document.createElement('audio');
      const url = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        reject(new Error('无法读取音频文件'));
      });
      
      audio.src = url;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型（支持常见音频格式）
    const allowedTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/m4a'];
    const allowedExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    
    if (!file.type.startsWith('audio/') && !allowedTypes.includes(file.type)) {
      if (!fileExt || !allowedExtensions.includes(fileExt)) {
        alert('请选择音频文件（支持格式：MP3, WAV, OGG, AAC, M4A）');
        return;
      }
    }

    // 验证文件大小（限制50MB，根据配置的max-material-size）
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      alert(`文件大小不能超过${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 获取音频时长
      const duration = await getAudioDuration(file);
      console.log('音频时长:', duration, '秒');
      
      // 通知父组件音频时长
      if (onDurationChange) {
        onDurationChange(Math.round(duration));
      }
    } catch (error) {
      console.error('获取音频时长失败:', error);
      // 继续上传，即使获取时长失败
    }

    try {
      // 使用后端API上传，避免CORS问题
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // 监听上传进度
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
        }
      });

      // 监听上传完成
      xhr.addEventListener('load', () => {
        setUploading(false);
        
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          onChange(response.url);
        } else {
          const error = JSON.parse(xhr.responseText);
          alert('上传失败: ' + (error.error || '未知错误'));
        }
      });

      // 监听上传错误
      xhr.addEventListener('error', () => {
        setUploading(false);
        alert('上传失败，请检查网络连接');
      });

      // 发送请求
      xhr.open('POST', '/api/cos/upload');
      xhr.send(formData);
    } catch (error) {
      setUploading(false);
      console.error('上传错误:', error);
      alert('上传失败，请重试');
    }
  };

  const handleClear = () => {
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          onChange={handleFileSelect}
          className="hidden"
          disabled={uploading}
        />
        
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4 mr-2" />
          {uploading ? '上传中...' : '上传音频'}
        </button>

        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <X className="w-4 h-4 mr-1" />
            清除
          </button>
        )}
      </div>

      <div className="flex gap-6 mt-3">
        {uploading && (
          <div className="flex-1">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-1">{progress}%</p>
          </div>
        )}

        {value && (
          <div className="flex-1">
            <p className="text-sm text-gray-600 mb-2">当前音频：</p>
            <audio controls className="w-full max-w-md">
              <source src={value} />
              您的浏览器不支持音频播放
            </audio>
            <p className="text-xs text-gray-400 mt-1 break-all">{value}</p>
          </div>
        )}
      </div>
    </div>
  );
}
