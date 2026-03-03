/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  User, 
  Scale, 
  ChevronRight,
  Loader2,
  FileSearch,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  Square,
  History,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { extractTextFromPdf } from './services/pdfService';
import { classifyProceduralActs } from './services/geminiService';
import { generateReportPdf } from './services/reportService';
import { ProceduralAct, Lawyer } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type View = 'upload' | 'dashboard';

export default function App() {
  const [view, setView] = useState<View>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<ProceduralAct[] | null>(null);
  const [history, setHistory] = useState<ProceduralAct[]>([]);
  const [reportsHistory, setReportsHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // Fetch history from API
  const fetchHistory = useCallback(async () => {
    try {
      const [actsRes, reportsRes] = await Promise.all([
        fetch('/api/acts'),
        fetch('/api/reports')
      ]);
      
      if (actsRes.ok) {
        const data = await actsRes.json();
        setHistory(data);
      }
      
      if (reportsRes.ok) {
        const data = await reportsRes.json();
        setReportsHistory(data);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResults(null);
      setError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false
  } as any);

  const handleProcess = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
      setStatus('Extraindo texto do PDF...');
      const text = await extractTextFromPdf(file);
      
      setStatus('Classificando atos com IA...');
      const classification = await classifyProceduralActs(text);
      
      // Sort: Alvará, Sentença, Acórdão first
      const sortedActs = [...classification.acts].sort((a, b) => {
        const priorityTypes = ['alvará', 'sentença', 'acórdão'];
        const aType = a.type.toLowerCase();
        const bType = b.type.toLowerCase();
        
        const aPriority = priorityTypes.findIndex(t => aType.includes(t));
        const bPriority = priorityTypes.findIndex(t => bType.includes(t));
        
        if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        return 0;
      });
      
      setResults(sortedActs);
      
      // Save to database
      setStatus('Salvando no histórico...');
      await fetch('/api/acts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sortedActs)
      });
      
      await fetchHistory();
      setStatus('');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocorreu um erro ao processar o arquivo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleFulfilled = async (id: string, currentStatus: boolean) => {
    try {
      await fetch(`/api/acts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFulfilled: !currentStatus })
      });
      await fetchHistory();
      if (results) {
        setResults(results.map(act => act.id === id ? { ...act, isFulfilled: !currentStatus } : act));
      }
    } catch (err) {
      console.error('Failed to toggle status:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja realmente excluir este registro?')) return;
    try {
      await fetch(`/api/acts/${id}`, { method: 'DELETE' });
      await fetchHistory();
      if (results) {
        setResults(results.filter(act => act.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete act:', err);
    }
  };

  const handleDownload = async () => {
    if (!results) return;
    
    // Generate PDF
    await generateReportPdf(results);
    
    // Save report to history
    try {
      const reportId = crypto.randomUUID();
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reportId,
          lawyerName: 'Relatório Geral', // Could be dynamic if needed
          actsCount: results.length,
          data: results
        })
      });
      await fetchHistory();
    } catch (err) {
      console.error('Failed to save report:', err);
    }
  };

  const getLawyerColor = (lawyer: Lawyer) => {
    switch (lawyer) {
      case Lawyer.ALEXSANDER: return 'bg-blue-50 text-blue-700 border-blue-200';
      case Lawyer.PABLINY: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case Lawyer.GABRIEL: return 'bg-amber-50 text-amber-700 border-amber-200';
      case Lawyer.MATHEUS: return 'bg-slate-50 text-slate-700 border-slate-200';
      default: return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-[#1A1A1A] font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-black/5 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-black rounded-2xl flex items-center justify-center shadow-xl shadow-black/20">
              <Scale className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter uppercase italic">Justo</h1>
              <p className="text-[10px] uppercase tracking-[0.2em] text-black/30 font-bold">Soluções Tecnológicas</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center bg-black/5 p-1 rounded-xl">
              <button 
                onClick={() => setView('upload')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                  view === 'upload' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black"
                )}
              >
                <Upload size={16} />
                Processar
              </button>
              <button 
                onClick={() => setView('dashboard')}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2",
                  view === 'dashboard' ? "bg-white text-black shadow-sm" : "text-black/40 hover:text-black"
                )}
              >
                <LayoutDashboard size={16} />
                Planilha
              </button>
            </nav>

            {results && view === 'upload' && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-black/80 transition-all active:scale-95"
              >
                <Download size={18} />
                Baixar Relatório
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <AnimatePresence mode="wait">
          {view === 'upload' ? (
            <motion.div 
              key="upload"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid lg:grid-cols-12 gap-12"
            >
              {/* Left Column: Upload & Status */}
              <div className="lg:col-span-4 space-y-8">
                <section className="space-y-4">
                  <h2 className="text-3xl font-light tracking-tight">Distribuidor de Atos</h2>
                  <p className="text-black/60 leading-relaxed">
                    Carregue o seu <strong>documento compilado</strong> contendo múltiplos atos processuais. Nossa IA irá segmentar cada ato e distribuí-los automaticamente para a equipe da Justo.
                  </p>
                </section>

                <div 
                  {...getRootProps()} 
                  className={cn(
                    "border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center text-center transition-all cursor-pointer",
                    isDragActive ? "border-black bg-black/5" : "border-black/10 hover:border-black/20 bg-white",
                    file && !results && "border-emerald-500/50 bg-emerald-50/30"
                  )}
                >
                  <input {...getInputProps()} />
                  <div className={cn(
                    "w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-colors",
                    file ? "bg-emerald-100 text-emerald-600" : "bg-black/5 text-black/40"
                  )}>
                    {file ? <CheckCircle2 size={32} /> : <Upload size={32} />}
                  </div>
                  
                  {file ? (
                    <div className="space-y-1">
                      <p className="font-medium text-sm truncate max-w-[200px]">{file.name}</p>
                      <p className="text-xs text-black/40">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="font-medium text-sm">Arraste o PDF aqui</p>
                      <p className="text-xs text-black/40">ou clique para selecionar</p>
                    </div>
                  )}
                </div>

                {file && !results && !isProcessing && (
                  <button
                    onClick={handleProcess}
                    className="w-full bg-black text-white py-4 rounded-2xl font-semibold flex items-center justify-center gap-2 hover:bg-black/90 transition-all shadow-lg shadow-black/10"
                  >
                    <FileSearch size={20} />
                    Processar Documento
                  </button>
                )}

                {isProcessing && (
                  <div className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin text-black/40" size={20} />
                      <span className="text-sm font-medium">{status}</span>
                    </div>
                    <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-black"
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 15, ease: "linear" }}
                      />
                    </div>
                    <p className="text-[10px] text-black/40 uppercase tracking-wider text-center">Isso pode levar alguns segundos</p>
                  </div>
                )}

                {error && (
                  <div className="bg-red-50 border border-red-100 rounded-2xl p-4 flex gap-3 text-red-700">
                    <AlertCircle className="shrink-0" size={20} />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Historical Reports */}
                <div className="bg-white border border-black/5 rounded-[32px] p-8 space-y-6 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20">Relatórios Anteriores</h3>
                    <p className="text-sm font-bold">Histórico de Exportação</p>
                  </div>
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {reportsHistory.map((report) => (
                      <button
                        key={report.id}
                        onClick={() => {
                          setResults(report.data);
                          setView('upload');
                        }}
                        className="w-full group flex items-center justify-between p-3 rounded-2xl hover:bg-black/5 transition-all text-left border border-transparent hover:border-black/5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-black/5 rounded-xl flex items-center justify-center text-black/40 group-hover:bg-black group-hover:text-white transition-all">
                            <FileText size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-bold">{new Date(report.createdAt).toLocaleDateString('pt-BR')}</p>
                            <p className="text-[10px] text-black/40 font-medium uppercase">{report.actsCount} Atos Identificados</p>
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-black/20 group-hover:text-black transition-all" />
                      </button>
                    ))}
                    {reportsHistory.length === 0 && (
                      <p className="text-[10px] text-black/30 text-center py-4 italic">Nenhum relatório salvo ainda.</p>
                    )}
                  </div>
                </div>

                {/* Rules Legend */}
                <div className="bg-white border border-black/5 rounded-[32px] p-8 space-y-6 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-black/20">Equipe Jurídica</h3>
                    <p className="text-sm font-bold">Diretrizes de Distribuição</p>
                  </div>
                  <div className="space-y-4">
                    {[
                      { lawyer: Lawyer.ALEXSANDER, area: "Cível", color: "bg-blue-500" },
                      { lawyer: Lawyer.PABLINY, area: "Cálculos", color: "bg-emerald-500" },
                      { lawyer: Lawyer.GABRIEL, area: "Trabalhista", color: "bg-amber-500" },
                      { lawyer: Lawyer.MATHEUS, area: "Outros", color: "bg-slate-500" },
                    ].map((rule) => (
                      <div key={rule.lawyer} className="group flex items-center gap-4">
                        <div className={cn("w-1 h-8 rounded-full transition-all group-hover:h-10", rule.color)} />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-black/30">{rule.area}</p>
                          <p className="text-sm font-bold">{rule.lawyer}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:col-span-8">
                <AnimatePresence mode="wait">
                  {results ? (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="space-y-6"
                    >
                      <div className="flex items-center justify-between mb-8">
                        <h3 className="text-xl font-bold">Atos Identificados ({results.length})</h3>
                        <div className="flex gap-2">
                          <div className="px-3 py-1 bg-white border border-black/5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                            Processado com Sucesso
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4">
                        {results.map((act, idx) => {
                          const isAlvara = act.type.toLowerCase().includes('alvará');
                          const isPriority = isAlvara || act.type.toLowerCase().includes('sentença') || act.type.toLowerCase().includes('acórdão');
                          
                          return (
                            <motion.div
                              key={act.id}
                              initial={{ opacity: 0, x: 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={cn(
                                "bg-white border rounded-3xl p-6 hover:shadow-xl hover:shadow-black/5 transition-all group relative overflow-hidden",
                                isAlvara ? "border-emerald-500/30 bg-emerald-50/10" : "border-black/5",
                                isPriority && !isAlvara && "border-blue-500/20 bg-blue-50/5"
                              )}
                            >
                              {isPriority && (
                                <div className={cn(
                                  "absolute top-0 right-0 px-4 py-1 text-[8px] font-black uppercase tracking-[0.2em] rounded-bl-xl",
                                  isAlvara ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                                )}>
                                  Prioridade Máxima
                                </div>
                              )}
                              
                              <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                                <div className="space-y-3 flex-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={cn(
                                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                      isAlvara ? "bg-emerald-500 text-white" : "bg-black/5"
                                    )}>
                                      {act.type}
                                    </span>
                                    <span className={cn(
                                      "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                                      getLawyerColor(act.lawyer)
                                    )}>
                                      {act.lawyer}
                                    </span>
                                    {act.date && (
                                      <span className="px-3 py-1 bg-black/5 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                                        <Calendar size={10} />
                                        {act.date}
                                      </span>
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <h4 className={cn(
                                      "text-lg font-bold group-hover:text-black transition-colors",
                                      isPriority && "text-black"
                                    )}>{act.title}</h4>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-bold text-black/40 uppercase tracking-tight">
                                      <span className="flex items-center gap-1">
                                        <Scale size={12} />
                                        {act.court} / {act.chamber}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <FileText size={12} />
                                        {act.caseNumber}
                                      </span>
                                      <span className="flex items-center gap-1 text-black/60">
                                        <User size={12} />
                                        {act.parties}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-black/60 leading-relaxed">
                                    {act.summary}
                                  </p>
                                  <div className="pt-2">
                                    <p className="text-[10px] text-black/30 font-mono italic line-clamp-1">
                                      "{act.originalTextSnippet}..."
                                    </p>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-4">
                                  <button
                                    onClick={() => handleToggleFulfilled(act.id, act.isFulfilled)}
                                    className={cn(
                                      "p-2 rounded-xl transition-all",
                                      act.isFulfilled ? "bg-emerald-100 text-emerald-600" : "bg-black/5 text-black/20 hover:text-black/40"
                                    )}
                                  >
                                    {act.isFulfilled ? <CheckSquare size={24} /> : <Square size={24} />}
                                  </button>
                                  <div className="text-black/20 group-hover:text-black/40 transition-colors">
                                    <ChevronRight size={24} />
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ) : (
                    <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-4 bg-white/50 border border-dashed border-black/10 rounded-[40px]">
                      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-black/5">
                        <FileText className="text-black/10" size={40} />
                      </div>
                      <div className="space-y-1">
                        <h3 className="font-bold text-lg">Nenhum documento processado</h3>
                        <p className="text-sm text-black/40 max-w-[300px]">
                          Carregue um PDF na coluna ao lado para iniciar a análise automática.
                        </p>
                      </div>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-3xl font-light tracking-tight">Planilha de Andamentos</h2>
                  <p className="text-black/40 text-sm">Registro histórico de todos os atos processuais distribuídos.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="bg-white border border-black/5 px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2">
                    <History size={16} />
                    {history.length} Registros
                  </div>
                </div>
              </div>

              <div className="bg-white border border-black/5 rounded-[32px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-black/5 text-[10px] font-black uppercase tracking-[0.2em] text-black/40">
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Data</th>
                        <th className="px-6 py-4">Processo / Tribunal</th>
                        <th className="px-6 py-4">Ato / Tipo</th>
                        <th className="px-6 py-4">Responsável</th>
                        <th className="px-6 py-4">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black/5">
                      {history.map((act) => (
                        <tr key={act.id} className={cn("group transition-colors", act.isFulfilled ? "bg-emerald-50/20" : "hover:bg-black/[0.02]")}>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleFulfilled(act.id, act.isFulfilled)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                act.isFulfilled ? "text-emerald-600" : "text-black/10 hover:text-black/30"
                              )}
                            >
                              {act.isFulfilled ? <CheckSquare size={20} /> : <Square size={20} />}
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-xs font-bold text-black/60">{act.date || '-'}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold">{act.caseNumber}</p>
                              <p className="text-[10px] text-black/40 uppercase font-bold">{act.court} / {act.chamber}</p>
                              <p className="text-[10px] text-black/60 font-medium italic">{act.parties}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold truncate max-w-[200px]">{act.title}</p>
                              <p className="text-[10px] text-black/40 uppercase font-bold">{act.type}</p>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "px-2 py-1 rounded-lg text-[10px] font-bold uppercase border",
                              getLawyerColor(act.lawyer)
                            )}>
                              {act.lawyer}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <button 
                              onClick={() => handleDelete(act.id)}
                              className="p-2 text-black/10 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {history.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <div className="flex flex-col items-center gap-2 text-black/20">
                              <History size={40} />
                              <p className="text-sm font-bold">Nenhum registro encontrado</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-6 py-12 border-t border-black/5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <p className="text-xs text-black/40">
            © {new Date().getFullYear()} Justo - Soluções Tecnológicas. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-6 text-[10px] font-bold uppercase tracking-widest text-black/40">
            <a href="#" className="hover:text-black transition-colors">Privacidade</a>
            <a href="#" className="hover:text-black transition-colors">Termos</a>
            <a href="#" className="hover:text-black transition-colors">Suporte</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
