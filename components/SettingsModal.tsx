import React, { useState, useEffect } from 'react';
import { X, Save, Database, Key } from 'lucide-react';
import { AppConfig } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AppConfig) => void;
  initialConfig: AppConfig;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, initialConfig }) => {
  const [config, setConfig] = useState<AppConfig>(initialConfig);

  useEffect(() => {
    setConfig(initialConfig);
  }, [initialConfig]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <Database size={18} className="text-emerald-600" />
            Configuração do Sistema
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-5">
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <p className="text-xs text-blue-700 leading-relaxed">
              <strong>Atenção:</strong> A URL e a Key do Supabase são salvas no seu navegador para conectar ao banco. A Key do Abacate Pay será salva <strong>dentro do seu Supabase</strong> (tabela <code>app_config</code>).
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Database size={14} /> Conexão Supabase
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500">Supabase URL</label>
              <input
                type="text"
                value={config.supabaseUrl}
                onChange={(e) => setConfig({ ...config, supabaseUrl: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="https://xyz.supabase.co"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500">Supabase Anon Key</label>
              <input
                type="password"
                value={config.supabaseKey}
                onChange={(e) => setConfig({ ...config, supabaseKey: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
              <Key size={14} /> Abacate Pay (Salvo no DB)
            </h3>
            <div className="space-y-1">
              <label className="text-xs font-semibold uppercase text-gray-500">API Key (Bearer)</label>
              <input
                type="password"
                value={config.abacateApiKey}
                onChange={(e) => setConfig({ ...config, abacateApiKey: e.target.value })}
                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                placeholder="Preencha apenas se quiser atualizar no banco"
              />
              <p className="text-[10px] text-gray-400">Deixe em branco para usar a chave já salva no banco.</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-gray-50 flex justify-end">
          <button
            onClick={() => onSave(config)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg font-medium transition-all shadow-md hover:shadow-lg active:scale-95"
          >
            <Save size={18} />
            Salvar e Conectar
          </button>
        </div>
      </div>
    </div>
  );
};
