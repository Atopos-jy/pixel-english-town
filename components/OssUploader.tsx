'use client';

import { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';

interface OssUploaderProps {
  value: string;
  onChange: (url: string) => void;
  onDurationChange?: (duration: number) => void;
}

// 管理后台文章音频上传控件；文件实际由服务端写入阿里云 OSS。
export default function OssUploader({ value, onChange, onDurationChange }: OssUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !['mp3', 'wav', 'ogg', 'aac', 'm4a'].includes(extension)) {
      alert('请选择 MP3、WAV、OGG、AAC 或 M4A 音频');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('音频文件不能超过 50MB');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const duration = await new Promise<number>((resolve, reject) => {
        const audio = document.createElement('audio');
        const localUrl = URL.createObjectURL(file);
        audio.onloadedmetadata = () => {
          URL.revokeObjectURL(localUrl);
          resolve(audio.duration);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(localUrl);
          reject(new Error('无法读取音频时长'));
        };
        audio.src = localUrl;
      });
      onDurationChange?.(Math.round(duration));
    } catch {
      // 音频元数据不可读不阻断上传，后台仍可保存文件。
    }

    const formData = new FormData();
    formData.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (progressEvent) => {
      if (progressEvent.lengthComputable) {
        setProgress(Math.round((progressEvent.loaded / progressEvent.total) * 100));
      }
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        onChange(JSON.parse(xhr.responseText).url);
      } else {
        const response = JSON.parse(xhr.responseText || '{}');
        alert(`上传失败：${response.error || '未知错误'}`);
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      alert('上传失败，请检查网络连接');
    };
    xhr.open('POST', '/api/oss/upload');
    xhr.send(formData);
  }

  return (
    <div>
      <div className="flex items-center gap-3">
        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" disabled={uploading}
          onChange={handleFileSelect} />
        <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          <Upload className="w-4 h-4 mr-2" />{uploading ? '上传中...' : '上传音频'}
        </button>
        {value && <button type="button" onClick={() => { onChange(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
          className="flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"><X className="w-4 h-4 mr-1" />清除</button>}
      </div>
      {uploading && <div className="flex-1 mt-3"><div className="w-full bg-gray-200 rounded-full h-2"><div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} /></div><p className="text-sm text-gray-500 mt-1">{progress}%</p></div>}
      {value && <div className="mt-3"><p className="text-sm text-gray-600 mb-2">当前音频：</p><audio controls className="w-full max-w-md"><source src={value} />您的浏览器不支持音频播放</audio><p className="text-xs text-gray-400 mt-1 break-all">{value}</p></div>}
    </div>
  );
}
