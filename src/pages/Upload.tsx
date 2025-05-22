
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, FileText, Database, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import UploadArea from '@/components/UploadArea';
import FilePreview from '@/components/FilePreview';
import LoadingAnalysis from '@/components/LoadingAnalysis';
import { toast } from '@/hooks/use-toast';

interface UploadedFile {
  file: File;
  type: 'csv' | 'pdf';
  preview?: string;
}

const Upload = () => {
  const navigate = useNavigate();
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileUpload = (files: File[]) => {
    const newFiles: UploadedFile[] = files.map(file => ({
      file,
      type: file.type === 'text/csv' ? 'csv' : 'pdf'
    }));
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    
    toast({
      title: "Arquivos carregados",
      description: `${files.length} arquivo(s) adicionado(s) com sucesso.`,
    });
  };

  const removeFile = (index: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (uploadedFiles.length === 0) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Por favor, faça upload dos arquivos antes de analisar.",
        variant: "destructive"
      });
      return;
    }

    setIsAnalyzing(true);
    
    // Simulate API call
    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast({
        title: "Análise concluída",
        description: "Redirecionando para o dashboard...",
      });
      
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      toast({
        title: "Erro na análise",
        description: "Ocorreu um erro durante o processamento. Tente novamente.",
        variant: "destructive"
      });
      setIsAnalyzing(false);
    }
  };

  if (isAnalyzing) {
    return <LoadingAnalysis />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-golden-400 to-golden-600 shadow-lg">
              <Sparkles className="w-8 h-8 text-dark-900" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-golden-400 to-golden-600 bg-clip-text text-transparent">
              Discrepômetro
            </h1>
          </div>
          <p className="text-xl text-dark-300 max-w-2xl mx-auto">
            Sistema inteligente de análise fiscal para detecção de discrepâncias
          </p>
        </div>

        {/* Upload Section */}
        <Card className="glass-effect p-8">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-semibold text-foreground">Upload Inteligente</h2>
              <p className="text-dark-400">
                Faça upload do CSV com movimentações e PDFs de inventário
              </p>
            </div>

            {/* File Requirements */}
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="neomorphism p-4 border-dark-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-golden-500/20">
                    <Database className="w-5 h-5 text-golden-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">Arquivo CSV</h3>
                    <p className="text-sm text-dark-400 mt-1">
                      Movimentações com CFOP, produtos, quantidades e valores
                    </p>
                    <div className="text-xs text-dark-500 mt-2">
                      Até 2 milhões de linhas
                    </div>
                  </div>
                </div>
              </Card>

              <Card className="neomorphism p-4 border-dark-700/50">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-golden-500/20">
                    <FileText className="w-5 h-5 text-golden-400" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">PDFs de Inventário</h3>
                    <p className="text-sm text-dark-400 mt-1">
                      2 inventários de anos distintos para comparação
                    </p>
                    <div className="text-xs text-dark-500 mt-2">
                      Formato PDF padrão
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Upload Area */}
            <UploadArea onFileUpload={handleFileUpload} />

            {/* File Preview */}
            {uploadedFiles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-foreground">Arquivos Carregados</h3>
                <div className="grid gap-3">
                  {uploadedFiles.map((file, index) => (
                    <FilePreview
                      key={index}
                      file={file}
                      onRemove={() => removeFile(index)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Analyze Button */}
            <div className="flex justify-center pt-4">
              <Button
                onClick={handleAnalyze}
                size="lg"
                className="bg-gradient-to-r from-golden-500 to-golden-600 hover:from-golden-600 hover:to-golden-700 text-dark-900 font-semibold px-8 py-3 rounded-xl transition-all duration-300 hover:scale-105 golden-glow"
                disabled={uploadedFiles.length === 0}
              >
                <UploadIcon className="w-5 h-5 mr-2" />
                Analisar Arquivos
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Upload;
