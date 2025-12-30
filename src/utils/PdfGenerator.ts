import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Definimos las interfaces de los datos que recibiremos (coincidentes con el estado de page.tsx)
interface SubPartida {
  concepto: string;
  cantidad: number;
  unidad: string;
  valor_unitario: number;
}

interface Activo {
  id: string;
  nombre: string;
  divisible: boolean;
  sub_partidas: SubPartida[];
  valorTotal?: number; // Calculado
}

interface LoteItem {
  nombre: string;
  valor: number;
  fraccion: number;
}

interface Lote {
  id: number;
  nombreHeredero: string;
  activos: LoteItem[];
  valorBienes: number;
}

interface Compensacion {
  heredero: number;
  nombreHeredero: string;
  diferencia: number;
}

export interface ReportData {
  config: {
    numHerederos: number;
    moneda: string;
    fecha: string;
    sessionCode?: string;
  };
  metricas: {
    caudalRelicto: number;
    cuotaIdeal: number;
  };
  inventario: Activo[];
  reparto: {
    lotes: Lote[];
    compensaciones: Compensacion[];
  };
  textoExplicativo: string;
}

export class PdfGenerator {
  private doc: jsPDF;
  private primaryColor = [79, 70, 229]; // Indigo-600
  private secondaryColor = [100, 116, 139]; // Slate-500
  private currency: string;

  constructor(currency: string = 'EUR') {
    this.doc = new jsPDF();
    this.currency = currency;
  }

  private formatCurrency(amount: number): string {
    const currencyMap: Record<string, string> = { 'EUR': '€', 'USD': '$', 'MXN': '$' };
    const symbol = currencyMap[this.currency] || this.currency;

    return new Intl.NumberFormat('es-ES', { 
      style: 'decimal',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    }).format(amount) + ' ' + symbol;
  }

  private addHeader(title: string, subtitle?: string) {
    this.doc.setFillColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.rect(0, 0, 210, 40, 'F');
    
    this.doc.setTextColor(255, 255, 255);
    this.doc.setFontSize(22);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, 15, 20);
    
    if (subtitle) {
      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(subtitle, 15, 30);
    }
  }

  private addSectionTitle(title: string, y: number) {
    this.doc.setFontSize(14);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(title, 15, y);
    this.doc.setDrawColor(this.secondaryColor[0], this.secondaryColor[1], this.secondaryColor[2]);
    this.doc.line(15, y + 2, 195, y + 2);
  }

  public generate(data: ReportData) {
    // COVER PAGE
    const subtitle = `Generado el ${data.config.fecha}${data.config.sessionCode ? ` | Ref: ${data.config.sessionCode}` : ''}`;
    this.addHeader("Informe Técnico de Partición", subtitle);

    // Resumen Ejecutivo
    let y = 60;
    this.doc.setFontSize(12);
    this.doc.setTextColor(0, 0, 0);
    this.doc.text("Resumen Ejecutivo:", 15, y);
    
    // Cards simuladas con texto
    y += 10;
    this.doc.setFontSize(10);
    this.doc.text(`Caudal Relicto Total: ${this.formatCurrency(data.metricas.caudalRelicto)}`, 20, y);
    this.doc.text(`Número de Herederos: ${data.config.numHerederos}`, 20, y + 7);
    this.doc.text(`Cuota Ideal por Heredero: ${this.formatCurrency(data.metricas.cuotaIdeal)}`, 20, y + 14);

    // INVENTARIO
    y += 25;
    this.addSectionTitle("1. Inventario del Caudal Relicto", y);
    
    const inventoryBody = data.inventario.map(activo => {
        // Calcular valor total si no viene
        const total = activo.sub_partidas.reduce((a, b) => a + (b.cantidad * b.valor_unitario), 0);
        return [
            activo.nombre,
            activo.divisible ? 'SÍ' : 'NO',
            activo.sub_partidas.length + ' partidas',
            this.formatCurrency(total)
        ];
    });

    autoTable(this.doc, {
        startY: y + 10,
        head: [['Activo', 'Divisible', 'Detalle', 'Valor Total']],
        body: inventoryBody,
        headStyles: { fillColor: this.primaryColor as any },
        theme: 'grid'
    });

    // REPARTO
    let finalY = (this.doc as any).lastAutoTable.finalY + 20;
    this.addSectionTitle("2. Propuesta de Adjudicación", finalY);
    
    let currentY = finalY + 10;

    data.reparto.lotes.forEach((lote) => {
        // Check page break
        if (currentY > 250) {
            this.doc.addPage();
            currentY = 20;
            this.addSectionTitle("2. Propuesta de Adjudicación (Cont.)", currentY);
            currentY += 15;
        }

        this.doc.setFontSize(11);
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`${lote.nombreHeredero}`, 15, currentY);
        
        const diff = lote.valorBienes - data.metricas.cuotaIdeal;
        const diffText = Math.abs(diff) < 1 ? "Equilibrado" : `${diff > 0 ? '+' : ''}${this.formatCurrency(diff)}`;
        
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        this.doc.text(`Valor Adjudicado: ${this.formatCurrency(lote.valorBienes)} (${diffText})`, 100, currentY);

        const loteBody = lote.activos.map(item => [
            item.nombre,
            `${(item.fraccion * 100).toFixed(1)}%`,
            this.formatCurrency(item.valor)
        ]);

        autoTable(this.doc, {
            startY: currentY + 5,
            head: [['Activo Adjudicado', '% Propiedad', 'Valor']],
            body: loteBody,
            theme: 'striped',
            headStyles: { fillColor: [100, 116, 139] },
            margin: { left: 20 }
        });

        currentY = (this.doc as any).lastAutoTable.finalY + 15;
    });

    // COMPENSACIONES
    if (currentY > 240) {
        this.doc.addPage();
        currentY = 20;
    }
    this.addSectionTitle("3. Compensaciones en Metálico", currentY);
    
    // Filtrar quienes pagan y cobran
    const debenPagar = data.reparto.compensaciones.filter(c => c.diferencia < -0.01);
    const debenCobrar = data.reparto.compensaciones.filter(c => c.diferencia > 0.01);
    
    if (debenPagar.length > 0) {
        currentY += 10;
        this.doc.setFontSize(10);
        this.doc.text("Para corregir las desviaciones de valor, se establecen los siguientes pagos:", 15, currentY);
        
        // Tabla simple de compensaciones
        const compBody = [
            ...debenPagar.map(c => [`${c.nombreHeredero}`, 'PAGA (Exceso)', this.formatCurrency(Math.abs(c.diferencia))]),
            ...debenCobrar.map(c => [`${c.nombreHeredero}`, 'RECIBE (Defecto)', this.formatCurrency(c.diferencia)])
        ];

        autoTable(this.doc, {
            startY: currentY + 5,
            head: [['Partícipe', 'Concepto', 'Importe']],
            body: compBody,
            headStyles: { fillColor: this.secondaryColor as any },
        });

        currentY = (this.doc as any).lastAutoTable.finalY + 15;
    } else {
        currentY += 10;
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'italic');
        this.doc.text("No se requieren compensaciones significativas.", 20, currentY);
        currentY += 10;
    }

    // CONCLUSIÓN
    if (currentY > 230) {
        this.doc.addPage();
        currentY = 20;
    }
    this.addSectionTitle("4. Memoria Explicativa", currentY);
    currentY += 10;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    const splitText = this.doc.splitTextToSize(data.textoExplicativo, 180);
    this.doc.text(splitText, 15, currentY);

    // Save
    this.doc.save(`Informe_Particion_${data.config.fecha.replace(/\//g, '-')}.pdf`);
  }
}
