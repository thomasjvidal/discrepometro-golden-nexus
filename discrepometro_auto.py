import os
import pandas as pd
import PyPDF2
import pdfplumber
from supabase import create_client
from dotenv import load_dotenv
from fuzzywuzzy import fuzz
import re
import glob
from typing import List, Optional
import tkinter as tk
from tkinter import filedialog

# Carregar variáveis de ambiente
load_dotenv()

def selecionar_arquivos():
    """Permite selecionar arquivos de qualquer lugar"""
    root = tk.Tk()
    root.withdraw()
    
    print("📄 Selecione o primeiro PDF de inventário:")
    pdf1 = filedialog.askopenfilename(
        title="Selecionar PDF Inventário 1",
        filetypes=[("PDF files", "*.pdf")]
    )
    
    print("📄 Selecione o segundo PDF de inventário:")
    pdf2 = filedialog.askopenfilename(
        title="Selecionar PDF Inventário 2", 
        filetypes=[("PDF files", "*.pdf")]
    )
    
    print("📊 Selecione a planilha de transações:")
    planilha = filedialog.askopenfilename(
        title="Selecionar Planilha",
        filetypes=[("Excel files", "*.xlsx"), ("CSV files", "*.csv")]
    )
    
    root.destroy()
    return pdf1, pdf2, planilha

class Discrepometro:
    def __init__(self):
        # Inicializar cliente Supabase
        self.supabase_url = os.getenv('SUPABASE_URL')
        self.supabase_key = os.getenv('SUPABASE_KEY')
        self.supabase = create_client(self.supabase_url, self.supabase_key)
        
        # Dicionário para armazenar dados do inventário
        self.inventario = {}
        
        # Dicionário para armazenar dados das transações
        self.transacoes = {}
        
        # Lista para armazenar discrepâncias encontradas
        self.discrepancias = []

    def processar_arquivos_selecionados(self, pdf1: str, pdf2: str, planilha: str):
        """Processa arquivos selecionados pelo usuário"""
        print("🚀 INICIANDO PROCESSAMENTO...")
        
        # Processar PDFs
        print(f"\nProcessando: {os.path.basename(pdf1)}")
        self.processar_pdf_inventario(pdf1)
        
        print(f"\nProcessando: {os.path.basename(pdf2)}")
        self.processar_pdf_inventario(pdf2)
        
        # Processar planilha
        print(f"\nProcessando: {os.path.basename(planilha)}")
        self.processar_planilha_transacoes(planilha)
        
        # Detectar e salvar discrepâncias
        if self.transacoes and self.inventario:
            self.detectar_discrepancias()
            self.salvar_discrepancias()
            self.gerar_relatorio()
        else:
            print("❌ Dados insuficientes para análise")

    def processar_pdf_inventario(self, arquivo_pdf: str):
        """
        Processa um arquivo PDF de inventário e extrai os dados relevantes.
        """
        if not os.path.exists(arquivo_pdf):
            raise FileNotFoundError(f"Arquivo PDF não encontrado: {arquivo_pdf}")
            
        try:
            print(f"\nProcessando arquivo: {arquivo_pdf}")
            with pdfplumber.open(arquivo_pdf) as pdf:
                for pagina in pdf.pages:
                    texto = pagina.extract_text()
                    # Ajustar regex conforme o formato real do PDF
                    padrao = r'(\d+)\s*-\s*([A-Z0-9\s]+)\s*-\s*(\d+)'
                    matches = re.finditer(padrao, texto)
                    
                    for match in matches:
                        codigo = match.group(1)
                        nome_produto = match.group(2).strip()
                        quantidade = int(match.group(3))
                        
                        self.inventario[codigo] = {
                            'nome': nome_produto,
                            'quantidade': quantidade
                        }
            
            print(f"Processamento concluído. {len(self.inventario)} itens encontrados.")
                        
        except Exception as e:
            print(f"Erro ao processar PDF de inventário: {str(e)}")
            raise

    def processar_planilha_transacoes(self, arquivo_excel: str):
        """
        Processa um arquivo Excel/CSV de transações e extrai os dados relevantes.
        """
        if not os.path.exists(arquivo_excel):
            raise FileNotFoundError(f"Arquivo Excel/CSV não encontrado: {arquivo_excel}")
            
        try:
            print(f"\nProcessando arquivo: {arquivo_excel}")
            # Ler arquivo Excel/CSV
            df = pd.read_excel(arquivo_excel) if arquivo_excel.endswith('.xlsx') else pd.read_csv(arquivo_excel)
            
            # Mostrar colunas disponíveis
            print("\nColunas encontradas no arquivo:")
            for col in df.columns:
                print(f"- {col}")
            
            # Mapear nomes das colunas conforme necessário
            mapeamento_colunas = {
                'codigo': 'Código',
                'nome': 'Nome do Produto',
                'quantidade': 'Quantidade',
                'data': 'Data',
                'tipo': 'Tipo de Movimento'
            }
            
            # Renomear colunas conforme mapeamento
            df = df.rename(columns=mapeamento_colunas)
            
            # Processar cada linha
            for _, row in df.iterrows():
                codigo = str(row['codigo'])
                if codigo not in self.transacoes:
                    self.transacoes[codigo] = []
                
                self.transacoes[codigo].append({
                    'nome': row['nome'],
                    'quantidade': int(row['quantidade']),
                    'data': row['data'],
                    'tipo': row['tipo']
                })
            
            print(f"Processamento concluído. {len(self.transacoes)} produtos processados.")
                
        except Exception as e:
            print(f"Erro ao processar planilha de transações: {str(e)}")
            raise

    def detectar_discrepancias(self):
        """
        Detecta discrepâncias entre o inventário e as transações.
        """
        print("\nDetectando discrepâncias...")
        for codigo, dados_inventario in self.inventario.items():
            if codigo in self.transacoes:
                # Calcular quantidade total das transações
                qtd_transacoes = sum(
                    t['quantidade'] if t['tipo'] == 'ENTRADA' else -t['quantidade']
                    for t in self.transacoes[codigo]
                )
                
                # Verificar discrepância
                if qtd_transacoes != dados_inventario['quantidade']:
                    self.discrepancias.append({
                        'codigo': codigo,
                        'nome': dados_inventario['nome'],
                        'quantidade_inventario': dados_inventario['quantidade'],
                        'quantidade_transacoes': qtd_transacoes,
                        'diferenca': dados_inventario['quantidade'] - qtd_transacoes
                    })

    def salvar_discrepancias(self):
        """
        Salva as discrepâncias encontradas no Supabase.
        """
        try:
            print("\nSalvando discrepâncias no Supabase...")
            for discrepancia in self.discrepancias:
                self.supabase.table('discrepancias').insert(discrepancia).execute()
            print("Discrepâncias salvas com sucesso!")
        except Exception as e:
            print(f"Erro ao salvar discrepâncias: {str(e)}")
            raise

    def gerar_relatorio(self):
        """
        Gera um relatório das discrepâncias encontradas.
        """
        print("\n=== Relatório de Discrepâncias ===")
        print(f"Total de discrepâncias encontradas: {len(self.discrepancias)}")
        
        for d in self.discrepancias:
            print(f"\nCódigo: {d['codigo']}")
            print(f"Nome: {d['nome']}")
            print(f"Quantidade no Inventário: {d['quantidade_inventario']}")
            print(f"Quantidade nas Transações: {d['quantidade_transacoes']}")
            print(f"Diferença: {d['diferenca']}")
            print("-" * 50)

def main():
    # Criar instância do Discrepômetro
    discrepometro = Discrepometro()
    
    try:
        # Selecionar arquivos via interface gráfica
        pdf1, pdf2, planilha = selecionar_arquivos()
        
        if not all([pdf1, pdf2, planilha]):
            print("❌ Seleção cancelada ou arquivos inválidos")
            return
        
        # Processar arquivos selecionados
        discrepometro.processar_arquivos_selecionados(pdf1, pdf2, planilha)
        
    except Exception as e:
        print(f"\nErro durante a execução: {str(e)}")
        print("Por favor, verifique se os arquivos estão no formato correto e tente novamente.")

if __name__ == "__main__":
    main()
