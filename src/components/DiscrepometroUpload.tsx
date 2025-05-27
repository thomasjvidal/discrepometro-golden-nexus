import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { parse } from 'papaparse';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { toast } from 'sonner';

interface Discrepancia {
  codigo: string;
  nome: string;
  quantidade_inventario: number;
  quantidade_transacoes: number;
  diferenca: number;
}

interface ProdutoInventario {
  codigo: string;
  nome: string;
  quantidade: number;
  unidade: string;
  ano: number;
  pagina: number;
}

interface Transacao {
  data: Date;
  produto: string;
  cfop: string;
  quantidade: number;
  valor: number;
}

const DiscrepometroUpload: React.FC = () => {
  const [pdf1, setPdf1] = useState<File | null>(null);
  const [pdf2, setPdf2] = useState<File | null>(null);
  const [planilha, setPlanilha] = useState<File | null>(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState<string>('');
  const [resultados, setResultados] = useState<{
    discrepancias: Discrepancia[];
    topProdutos: any[];
    resumo: any;
  } | null>(null);

  const processarPDF = async (file: File): Promise<ProdutoInventario[]> => {
    try {
      setProgresso('Lendo PDF...');
      
      const arrayBuffer = await file.arrayBuffer();
      const data = await pdfParse(arrayBuffer);
      const texto = data.text;
      
      // Detectar ano do cabeçalho
      const anoMatch = texto.match(/PERÍODO DA ESCRITURAÇÃO:\s*\d{2}\/\d{2}\/(\d{4})/);
      const ano = anoMatch ? parseInt(anoMatch[1]) : 2022;
      
      console.log(`Ano detectado no PDF: ${ano}`);
      
      // Padrão para linhas de produtos baseado no formato real
      const padrao = /(\d+)\s+([A-Z][A-Z\s\-\/\.\d]+)\s+(\d+[.,]?\d*)\s+(UN|PC|KG|LT)/g;
      const produtos: ProdutoInventario[] = [];
      let match;
      
      while ((match = padrao.exec(texto)) !== null) {
        const [, codigo, descricao, quantidade, unidade] = match;
        
        const descricaoLimpa = descricao.replace(/\s+/g, ' ').trim();
        const qtd = parseFloat(quantidade.replace(',', '.'));
        
        if (qtd > 0 && descricaoLimpa.length > 3) {
          produtos.push({
            codigo: codigo.trim(),
            nome: descricaoLimpa,
            quantidade: qtd,
            unidade: unidade,
            ano: ano,
            pagina: 1
          });
        }
      }
      
      console.log(`PDF ${ano}: ${produtos.length} produtos extraídos`);
      return produtos;
      
    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      throw new Error(`Falha ao processar PDF: ${error.message}`);
    }
  };

  const detectarColunas = (headers: string[]): Record<string, string> => {
    const mapeamento: Record<string, string> = {};
    
    // Padrões para detectar colunas
    const padroes = {
      data: /data|dt|emissao|emissão/i,
      produto: /produto|item|descrição|descricao|nome/i,
      cfop: /cfop|código\s*fiscal/i,
      quantidade: /quantidade|qtd|qtde/i,
      valor: /valor|preço|preco|unitário|unitario/i
    };

    headers.forEach(header => {
      Object.entries(padroes).forEach(([tipo, padrao]) => {
        if (padrao.test(header)) {
          mapeamento[tipo] = header;
        }
      });
    });

    return mapeamento;
  };

  const processarPlanilha = async (file: File): Promise<Transacao[]> => {
    try {
      setProgresso('Lendo planilha...');
      return new Promise((resolve, reject) => {
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target?.result as ArrayBuffer);
              const workbook = XLSX.read(data, { type: 'array' });
              const worksheet = workbook.Sheets[workbook.SheetNames[0]];
              const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
              
              // Detectar cabeçalhos
              const headers = jsonData[0] as string[];
              const mapeamento = detectarColunas(headers);
              
              console.log('Mapeamento de colunas detectado:', mapeamento);

              // Validar mapeamento
              const colunasObrigatorias = ['data', 'produto', 'cfop', 'quantidade'];
              const colunasFaltantes = colunasObrigatorias.filter(col => !mapeamento[col]);
              
              if (colunasFaltantes.length > 0) {
                throw new Error(`Colunas obrigatórias não encontradas: ${colunasFaltantes.join(', ')}`);
              }

              // Processar linhas
              const transacoes: Transacao[] = [];
              for (let i = 1; i < jsonData.length; i++) {
                const row = jsonData[i] as any[];
                if (row.length >= headers.length) {
                  transacoes.push({
                    data: new Date(row[headers.indexOf(mapeamento.data)]),
                    produto: String(row[headers.indexOf(mapeamento.produto)]),
                    cfop: String(row[headers.indexOf(mapeamento.cfop)]),
                    quantidade: Number(row[headers.indexOf(mapeamento.quantidade)]),
                    valor: mapeamento.valor ? Number(row[headers.indexOf(mapeamento.valor)]) : 0
                  });
                }
              }

              console.log(`Processadas ${transacoes.length} transações`);
              resolve(transacoes);
            } catch (error) {
              reject(error);
            }
          };
          reader.readAsArrayBuffer(file);
        } else {
          parse(file, {
            header: true,
            complete: (results) => {
              try {
                const headers = results.meta.fields || [];
                const mapeamento = detectarColunas(headers);
                
                console.log('Mapeamento de colunas detectado:', mapeamento);

                // Validar mapeamento
                const colunasObrigatorias = ['data', 'produto', 'cfop', 'quantidade'];
                const colunasFaltantes = colunasObrigatorias.filter(col => !mapeamento[col]);
                
                if (colunasFaltantes.length > 0) {
                  throw new Error(`Colunas obrigatórias não encontradas: ${colunasFaltantes.join(', ')}`);
                }

                const transacoes: Transacao[] = results.data.map((row: any) => ({
                  data: new Date(row[mapeamento.data]),
                  produto: String(row[mapeamento.produto]),
                  cfop: String(row[mapeamento.cfop]),
                  quantidade: Number(row[mapeamento.quantidade]),
                  valor: mapeamento.valor ? Number(row[mapeamento.valor]) : 0
                }));

                console.log(`Processadas ${transacoes.length} transações`);
                resolve(transacoes);
              } catch (error) {
                reject(error);
              }
            },
            error: reject
          });
        }
      });
    } catch (error) {
      console.error('Erro ao processar planilha:', error);
      throw new Error(`Falha ao processar planilha: ${error.message}`);
    }
  };

  const detectarDiscrepancias = (
    inventario1: ProdutoInventario[],
    inventario2: ProdutoInventario[],
    transacoes: Transacao[]
  ): Discrepancia[] => {
    try {
      setProgresso('Detectando discrepâncias...');
      const discrepancias: Discrepancia[] = [];
      
      // Agrupar transações por produto
      const transacoesPorProduto = transacoes.reduce((acc, t) => {
        if (!acc[t.produto]) {
          acc[t.produto] = {
            compras: 0,
            vendas: 0
          };
        }
        
        if (t.cfop.startsWith('1')) {
          acc[t.produto].compras += t.quantidade;
        } else if (t.cfop.startsWith('5')) {
          acc[t.produto].vendas += t.quantidade;
        }
        
        return acc;
      }, {} as Record<string, { compras: number; vendas: number }>);

      // Comparar estoques
      inventario2.forEach(produto2 => {
        const produto1 = inventario1.find(p => p.codigo === produto2.codigo);
        const transacoes = transacoesPorProduto[produto2.nome] || { compras: 0, vendas: 0 };
        
        const estoque1 = produto1?.quantidade || 0;
        const estoque2 = produto2.quantidade;
        const compras = transacoes.compras;
        const vendas = transacoes.vendas;
        
        const estoqueEsperado = estoque1 + compras - vendas;
        const diferenca = estoque2 - estoqueEsperado;

        if (Math.abs(diferenca) > 10) { // Tolerância de 10 unidades
          discrepancias.push({
            codigo: produto2.codigo,
            nome: produto2.nome,
            quantidade_inventario: estoque2,
            quantidade_transacoes: estoqueEsperado,
            diferenca
          });
        }
      });

      console.log(`Detectadas ${discrepancias.length} discrepâncias`);
      return discrepancias;

    } catch (error) {
      console.error('Erro ao detectar discrepâncias:', error);
      throw new Error(`Falha ao detectar discrepâncias: ${error.message}`);
    }
  };

  const salvarNoSupabase = async (discrepancias: Discrepancia[]) => {
    try {
      setProgresso('Salvando no Supabase...');
      const { error } = await supabase
        .from('discrepancies')
        .insert(
          discrepancias.map(d => ({
            product_name: d.nome,
            product_code: d.codigo,
            discrepancy_type: d.diferenca > 0 ? 'estoque_excedente' : 'estoque_faltante',
            description: `Diferença de ${d.diferenca} unidades`,
            year_1_stock: 0,
            year_2_stock: d.quantidade_inventario,
            expected_stock: d.quantidade_transacoes,
            difference: d.diferenca,
            severity: Math.abs(d.diferenca) > 100 ? 'high' : 'medium',
            created_at: new Date().toISOString()
          }))
        );

      if (error) throw error;
      console.log('Discrepâncias salvas no Supabase');
      toast.success('Discrepâncias salvas com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar no Supabase:', error);
      toast.error('Erro ao salvar discrepâncias');
      throw error;
    }
  };

  const processar = async () => {
    if (!pdf1 || !pdf2 || !planilha) {
      toast.error('Por favor, selecione todos os arquivos necessários');
      return;
    }

    setProcessando(true);
    setProgresso('Iniciando processamento...');
    
    try {
      // Processar arquivos
      const inventario1 = await processarPDF(pdf1);
      const inventario2 = await processarPDF(pdf2);
      const transacoes = await processarPlanilha(planilha);

      console.log('Inventário 1:', inventario1.length, 'produtos');
      console.log('Inventário 2:', inventario2.length, 'produtos');
      console.log('Transações:', transacoes.length, 'registros');

      // Detectar discrepâncias
      const discrepancias = detectarDiscrepancias(inventario1, inventario2, transacoes);
      
      // Salvar no Supabase
      await salvarNoSupabase(discrepancias);

      // Mostrar resultados
      setResultados({
        discrepancias,
        topProdutos: [], // Implementar depois
        resumo: {
          totalInventario1: inventario1.length,
          totalInventario2: inventario2.length,
          totalTransacoes: transacoes.length,
          totalDiscrepancias: discrepancias.length
        }
      });

      toast.success('Processamento concluído com sucesso!');

    } catch (error) {
      console.error('Erro no processamento:', error);
      toast.error(`Erro no processamento: ${error.message}`);
    } finally {
      setProcessando(false);
      setProgresso('');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-3xl font-bold text-center mb-8 text-gray-800">
        Discrepômetro - Análise de Inventário
      </h2>

      {/* Upload de Arquivos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border-2 border-dashed border-blue-300 rounded-lg p-6 text-center">
          <h3 className="font-semibold mb-4 text-blue-800">PDF Inventário Ano 1</h3>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdf1(e.target.files?.[0] || null)}
            className="w-full mb-2"
          />
          {pdf1 && <p className="text-green-600 text-sm">✓ {pdf1.name}</p>}
        </div>

        <div className="border-2 border-dashed border-green-300 rounded-lg p-6 text-center">
          <h3 className="font-semibold mb-4 text-green-800">PDF Inventário Ano 2</h3>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setPdf2(e.target.files?.[0] || null)}
            className="w-full mb-2"
          />
          {pdf2 && <p className="text-green-600 text-sm">✓ {pdf2.name}</p>}
        </div>

        <div className="border-2 border-dashed border-purple-300 rounded-lg p-6 text-center">
          <h3 className="font-semibold mb-4 text-purple-800">Planilha Transações</h3>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => setPlanilha(e.target.files?.[0] || null)}
            className="w-full mb-2"
          />
          {planilha && <p className="text-green-600 text-sm">✓ {planilha.name}</p>}
        </div>
      </div>

      {/* Botão de Processamento */}
      <div className="text-center mb-8">
        <button
          onClick={processar}
          disabled={processando || !pdf1 || !pdf2 || !planilha}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold text-lg disabled:bg-gray-400 hover:bg-blue-700 transition-colors"
        >
          {processando ? `Processando... ${progresso}` : 'Processar e Detectar Discrepâncias'}
        </button>
      </div>

      {/* Resultados */}
      {resultados && (
        <div className="mt-8">
          <h3 className="text-2xl font-bold mb-4">Resultados da Análise</h3>
          
          {/* Resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-600">{resultados.resumo.totalInventario1}</div>
              <div className="text-sm text-blue-800">Produtos Ano 1</div>
            </div>
            <div className="bg-green-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-600">{resultados.resumo.totalInventario2}</div>
              <div className="text-sm text-green-800">Produtos Ano 2</div>
            </div>
            <div className="bg-purple-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-600">{resultados.resumo.totalTransacoes}</div>
              <div className="text-sm text-purple-800">Transações</div>
            </div>
            <div className="bg-red-100 p-4 rounded-lg text-center">
              <div className="text-2xl font-bold text-red-600">{resultados.resumo.totalDiscrepancias}</div>
              <div className="text-sm text-red-800">Discrepâncias</div>
            </div>
          </div>

          {/* Tabela de Discrepâncias */}
          {resultados.discrepancias.length > 0 && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="bg-red-50 px-6 py-3 border-b">
                <h4 className="text-lg font-semibold text-red-800">
                  Discrepâncias Detectadas ({resultados.discrepancias.length})
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produto</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque Real</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Estoque Esperado</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Diferença</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {resultados.discrepancias.map((disc, index) => (
                      <tr key={index} className={disc.diferenca < 0 ? 'bg-red-50' : 'bg-yellow-50'}>
                        <td className="px-6 py-4 font-medium">{disc.nome}</td>
                        <td className="px-6 py-4">{disc.quantidade_inventario.toLocaleString()}</td>
                        <td className="px-6 py-4">{disc.quantidade_transacoes.toLocaleString()}</td>
                        <td className={`px-6 py-4 font-bold ${disc.diferenca < 0 ? 'text-red-600' : 'text-yellow-600'}`}>
                          {disc.diferenca > 0 ? '+' : ''}{disc.diferenca.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {resultados.discrepancias.length === 0 && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded text-center">
              ✅ Nenhuma discrepância significativa encontrada!
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscrepometroUpload; 