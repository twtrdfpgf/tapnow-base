import React, { useState, useRef, useEffect } from 'react';
import { Icons } from './Icons';

interface AIPanelProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
}

// AI 模型配置
type AIModel = 'gpt-4o' | 'gpt-4o-mini' | 'claude-3-5-sonnet' | 'claude-3-7-sonnet' | 'glm-4' | 'glm-4v';

interface ModelInfo {
    id: AIModel;
    name: string;
    platform: 'openai' | 'anthropic' | 'zhipu';
}

const MODELS: ModelInfo[] = [
    { id: 'gpt-4o', name: 'GPT-4o', platform: 'openai' },
    { id: 'gpt-4o-mini', name: 'GPT-4o mini', platform: 'openai' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5', platform: 'anthropic' },
    { id: 'claude-3-7-sonnet', name: 'Claude 3.7', platform: 'anthropic' },
    { id: 'glm-4', name: 'GLM-4', platform: 'zhipu' },
    { id: 'glm-4v', name: 'GLM-4V', platform: 'zhipu' },
];

interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

// API 调用函数
async function callAI(model: AIModel, messages: Message[], apiKeys: Record<string, string>): Promise<string> {
    const modelInfo = MODELS.find(m => m.id === model);
    if (!modelInfo) throw new Error('未知模型');

    if (model.startsWith('claude')) {
        // Anthropic API
        const apiKey = apiKeys.anthropic;
        if (!apiKey) throw new Error('请先配置 Anthropic API Key');
        
        const modelMap: Record<string, string> = {
            'claude-3-5-sonnet': 'claude-sonnet-4-20250514',
            'claude-3-7-sonnet': 'claude-sonnet-4-20250514',
        };

        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
                model: modelMap[model] || model,
                max_tokens: 4096,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API 错误: ${response.status}`);
        }

        const data = await response.json();
        return data.content[0]?.text || '';
    } else if (model.startsWith('glm')) {
        // 智谱 API
        const apiKey = apiKeys.zhipu;
        if (!apiKey) throw new Error('请先配置智谱 API Key');

        const response = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model === 'glm-4v' ? 'glm-4v' : 'glm-4',
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API 错误: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    } else {
        // OpenAI API
        const apiKey = apiKeys.openai;
        if (!apiKey) throw new Error('请先配置 OpenAI API Key');

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: model,
                messages: messages.map(m => ({ role: m.role, content: m.content })),
            }),
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || `API 错误: ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0]?.message?.content || '';
    }
}

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2);

export const AIPanel: React.FC<AIPanelProps> = ({ isOpen, onClose, isDark }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-4o');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    
    // API Keys
    const [apiKeys, setApiKeys] = useState(() => ({
        openai: localStorage.getItem('ai-openai-key') || '',
        anthropic: localStorage.getItem('ai-anthropic-key') || '',
        zhipu: localStorage.getItem('ai-zhipu-key') || '',
    }));

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const saveSettings = () => {
        localStorage.setItem('ai-openai-key', apiKeys.openai);
        localStorage.setItem('ai-anthropic-key', apiKeys.anthropic);
        localStorage.setItem('ai-zhipu-key', apiKeys.zhipu);
        setShowSettings(false);
    };

    const handleSend = async () => {
        if (!input.trim() || loading) return;

        const userMessage: Message = {
            id: generateId(),
            role: 'user',
            content: input.trim(),
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        setError('');

        try {
            const reply = await callAI(selectedModel, [...messages, userMessage], apiKeys);

            const assistantMessage: Message = {
                id: generateId(),
                role: 'assistant',
                content: reply,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            setError(err instanceof Error ? err.message : '发生错误');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const clearChat = () => {
        setMessages([]);
        setError('');
    };

    if (!isOpen) return null;

    const currentPlatform = MODELS.find(m => m.id === selectedModel)?.platform || 'openai';
    const platformName = currentPlatform === 'openai' ? 'OpenAI' : currentPlatform === 'anthropic' ? 'Anthropic' : '智谱';
    const hasApiKey = !!apiKeys[currentPlatform];

    return (
        <div 
            className={`fixed right-0 top-0 h-full w-[400px] z-[200] border-l shadow-2xl animate-in slide-in-from-right duration-300 ${
                isDark ? 'bg-[#0B0C0E] border-zinc-800' : 'bg-white border-gray-200'
            }`}
        >
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2">
                    <Icons.Sparkles size={18} className={isDark ? 'text-pink-400' : 'text-pink-600'} />
                    <span className={`font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>AI 助手</span>
                </div>
                <div className="flex items-center gap-2">
                    <button 
                        onClick={clearChat}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                        title="清空聊天"
                    >
                        <Icons.Trash2 size={16} />
                    </button>
                    <button 
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-1.5 rounded-lg transition-colors ${showSettings ? (isDark ? 'bg-pink-500/20 text-pink-400' : 'bg-pink-50 text-pink-600') : (isDark ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600')}`}
                        title="API 设置"
                    >
                        <Icons.Settings size={16} />
                    </button>
                    <button 
                        onClick={onClose}
                        className={`p-1.5 rounded-lg transition-colors ${isDark ? 'hover:bg-zinc-800 text-gray-400' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <Icons.X size={16} />
                    </button>
                </div>
            </div>

            {/* API 设置 */}
            {showSettings && (
                <div className={`p-4 border-b ${isDark ? 'border-zinc-800 bg-zinc-900/50' : 'border-gray-200 bg-gray-50'}`}>
                    <div className={`text-xs font-medium mb-3 ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>API Key 配置</div>
                    
                    <div className="space-y-3">
                        <div>
                            <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>OpenAI API Key</label>
                            <input
                                type="password"
                                value={apiKeys.openai}
                                onChange={e => setApiKeys(k => ({ ...k, openai: e.target.value }))}
                                placeholder="sk-..."
                                className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                            />
                        </div>
                        <div>
                            <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>Anthropic API Key</label>
                            <input
                                type="password"
                                value={apiKeys.anthropic}
                                onChange={e => setApiKeys(k => ({ ...k, anthropic: e.target.value }))}
                                placeholder="sk-ant-..."
                                className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                            />
                        </div>
                        <div>
                            <label className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>智谱 API Key</label>
                            <input
                                type="password"
                                value={apiKeys.zhipu}
                                onChange={e => setApiKeys(k => ({ ...k, zhipu: e.target.value }))}
                                placeholder="..."
                                className={`w-full mt-1 px-3 py-2 text-sm rounded-lg border ${isDark ? 'bg-zinc-800 border-zinc-700 text-white placeholder-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400'}`}
                            />
                        </div>
                        <button
                            onClick={saveSettings}
                            className={`w-full py-2 text-sm font-medium rounded-lg transition-colors ${
                                isDark ? 'bg-pink-500 hover:bg-pink-400 text-white' : 'bg-pink-500 hover:bg-pink-600 text-white'
                            }`}
                        >
                            保存配置
                        </button>
                    </div>
                </div>
            )}

            {/* 模型选择 */}
            <div className={`px-4 py-2 border-b ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                <div className="flex flex-wrap gap-1.5">
                    {MODELS.map(model => (
                        <button
                            key={model.id}
                            onClick={() => setSelectedModel(model.id)}
                            className={`px-2.5 py-1 text-xs rounded-full transition-colors ${
                                selectedModel === model.id
                                    ? (isDark ? 'bg-pink-500/20 text-pink-400 border border-pink-500/30' : 'bg-pink-50 text-pink-600 border border-pink-200')
                                    : (isDark ? 'bg-zinc-800 text-gray-400 border border-zinc-700 hover:border-zinc-600' : 'bg-gray-100 text-gray-600 border border-gray-200 hover:border-gray-300')
                            }`}
                        >
                            {model.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex flex-col h-[calc(100%-120px)]">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4">
                    {messages.length === 0 && !error && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <div className={`text-4xl mb-3`}>🤖</div>
                            <h3 className={`text-lg font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                你好，我是 AI 助手
                            </h3>
                            <p className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-500'}`}>
                                请先选择模型并配置 API Key
                            </p>
                            {!hasApiKey && (
                                <p className={`text-xs mt-2 ${isDark ? 'text-pink-400' : 'text-pink-500'}`}>
                                    当前 {platformName} 未配置 API Key
                                </p>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className={`p-3 rounded-xl text-sm mb-4 ${isDark ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {error}
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`flex gap-3 mb-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                                msg.role === 'user' 
                                    ? (isDark ? 'bg-pink-500/20' : 'bg-pink-100')
                                    : (isDark ? 'bg-zinc-800' : 'bg-gray-100')
                            }`}>
                                {msg.role === 'user' ? '👤' : '🤖'}
                            </div>
                            <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                                msg.role === 'user'
                                    ? (isDark ? 'bg-pink-500 text-white rounded-tr-sm' : 'bg-pink-500 text-white rounded-tr-sm')
                                    : (isDark ? 'bg-zinc-800 text-gray-200 rounded-tl-sm' : 'bg-gray-100 text-gray-800 rounded-tl-sm')
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    ))}

                    {loading && (
                        <div className="flex gap-3 mb-4">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${isDark ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                                🤖
                            </div>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm ${isDark ? 'bg-zinc-800 text-gray-400' : 'bg-gray-100 text-gray-500'}`}>
                                思考中...
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className={`p-4 border-t ${isDark ? 'border-zinc-800' : 'border-gray-200'}`}>
                    <div className={`relative rounded-xl border ${isDark ? 'bg-zinc-900 border-zinc-800' : 'bg-white border-gray-200'}`}>
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="输入消息，按 Enter 发送..."
                            className={`w-full p-3 pr-12 text-sm bg-transparent resize-none outline-none ${
                                isDark ? 'text-white placeholder-gray-500' : 'text-gray-900 placeholder-gray-400'
                            }`}
                            rows={2}
                        />
                        <button 
                            onClick={handleSend}
                            disabled={!input.trim() || loading}
                            className={`absolute right-2 bottom-2 p-2 rounded-lg transition-colors ${
                                input.trim() && !loading
                                    ? (isDark ? 'bg-pink-500 hover:bg-pink-400 text-white' : 'bg-pink-500 hover:bg-pink-600 text-white')
                                    : (isDark ? 'bg-zinc-800 text-gray-500' : 'bg-gray-100 text-gray-400')
                            }`}
                        >
                            <Icons.ArrowUpDown size={16} className="rotate-90" />
                        </button>
                    </div>
                    <div className={`flex items-center justify-between mt-2 text-xs ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
                        <div className="flex items-center gap-2">
                            <span>{MODELS.find(m => m.id === selectedModel)?.name}</span>
                            {!hasApiKey && <span className="text-pink-500">⚠️</span>}
                        </div>
                        <div className="flex items-center gap-1">
                            <Icons.Cpu size={12} />
                            <span>{platformName}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
