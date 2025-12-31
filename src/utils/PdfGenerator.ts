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
  tipo?: 'gananciales' | 'herencia';
  virtual?: boolean;
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
    sessionUrl?: string;
    hasPassword?: boolean;
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
  fiscal?: {
    gananciales: boolean;
    usufructo: { enabled: boolean; edadViudo: number; valor: number };
    colacion: { id: string; concepto: string; valor: number }[];
  };
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
    const subtitle = `Generado el ${data.config.fecha}`;
    this.addHeader("Informe Técnico de Partición", subtitle);

    // Session Status & recovery - Rediseñado
    let y = 50;
    if (data.config.sessionCode && data.config.sessionCode !== "PENDIENTE") {
      // Info box container
      this.doc.setFillColor(248, 250, 252); // Very light slate
      this.doc.setDrawColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(15, y, 180, 48, 4, 4, 'F');
      
      // Bottom accent line
      this.doc.setFillColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
      this.doc.rect(15, y + 44, 180, 4, 'F');

      // Recovery Code Label
      this.doc.setFontSize(9);
      this.doc.setTextColor(100, 116, 139); // slate-500
      this.doc.setFont('helvetica', 'bold');
      this.doc.text("CÓDIGO DE RECUPERACIÓN", 105, y + 10, { align: 'center' });
      
      // The Code
      this.doc.setFontSize(22);
      this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
      this.doc.setFont('courier', 'bold');
      this.doc.text(data.config.sessionCode, 105, y + 20, { align: 'center' });
      
      // Security Status (NO EMOJIS TO AVOID ENCODING ISSUES)
      const statusText = data.config.hasPassword ? 'ACCESO PROTEGIDO' : 'ACCESO SIN CONTRASEÑA';
      const statusColor = data.config.hasPassword ? [22, 163, 74] : [217, 119, 6]; // dark green or dark amber
      
      this.doc.setFontSize(8);
      this.doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(statusText, 105, y + 27, { align: 'center' });
      
      // Capsule Button for Online Load
      if (data.config.sessionUrl) {
        const btnWidth = 50;
        const btnHeight = 8;
        const btnX = 105 - (btnWidth / 2);
        const btnY = y + 32;

        this.doc.setFillColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
        this.doc.roundedRect(btnX, btnY, btnWidth, btnHeight, 4, 4, 'F');
        
        this.doc.setFontSize(8);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFont('helvetica', 'bold');
        this.doc.textWithLink('CARGAR SESIÓN ONLINE', 105, btnY + 5.5, { 
          align: 'center',
          url: data.config.sessionUrl
        });
      } else {
        this.doc.setFontSize(8);
        this.doc.setTextColor(148, 163, 184); // slate-400
        this.doc.setFont('helvetica', 'normal');
        this.doc.text("Guarde este código para recuperar su sesión más tarde", 105, y + 38, { align: 'center' });
      }
      
      y += 60;
    }

    // Resumen Ejecutivo - Card Style
    this.doc.setFontSize(12);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text("Resumen Ejecutivo:", 15, y);
    
    y += 8;
    // Main metric card
    this.doc.setFillColor(241, 245, 249); // slate-100
    this.doc.roundedRect(15, y, 180, 20, 2, 2, 'F');
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(100, 116, 139); // slate-500
    this.doc.text("CAUDAL RELICTO TOTAL", 20, y + 7);
    this.doc.setFontSize(14);
    this.doc.setTextColor(30, 41, 59); // slate-800
    this.doc.text(this.formatCurrency(data.metricas.caudalRelicto), 20, y + 15);

    // Sub metrics
    const colWidth = 88;
    const subY = y + 25;
    
    // Left card
    this.doc.setFillColor(248, 250, 252); // slate-50
    this.doc.roundedRect(15, subY, colWidth, 18, 2, 2, 'F');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text("NÚMERO DE HEREDEROS", 20, subY + 7);
    this.doc.setFontSize(11);
    this.doc.setTextColor(30, 41, 59);
    this.doc.text(`${data.config.numHerederos}`, 20, subY + 14);

    // Right card
    this.doc.setFillColor(248, 250, 252);
    this.doc.roundedRect(15 + colWidth + 4, subY, colWidth, 18, 2, 2, 'F');
    this.doc.setFontSize(8);
    this.doc.setTextColor(100, 116, 139);
    this.doc.text("CUOTA IDEAL POR HEREDERO", 20 + colWidth + 4, subY + 7);
    this.doc.setFontSize(11);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.text(this.formatCurrency(data.metricas.cuotaIdeal), 20 + colWidth + 4, subY + 14);

    y = subY + 25;

    // DISTRIBUCIÓN VISUAL
    this.drawDistributionChart(data, y);
    y += 55;

    // INVENTARIO
    y += 25;
    this.addSectionTitle("1. Inventario del Caudal Relicto", y);
    y += 10;
    
    let invY = y;
    data.inventario.forEach((activo) => {
        const total = activo.sub_partidas.reduce((a, b) => a + (b.cantidad * b.valor_unitario), 0);
        
        // Check for page break before each asset table
        if (invY > 260) {
            this.doc.addPage();
            invY = 20;
        }

        const rows = activo.sub_partidas.map(sub => [
            { content: `   - ${sub.concepto}`, styles: { fontStyle: 'italic', textColor: [100, 116, 139] } },
            { content: `${sub.cantidad} ${sub.unidad}` },
            { content: this.formatCurrency(sub.valor_unitario) },
            { content: this.formatCurrency(sub.cantidad * sub.valor_unitario) }
        ]);

        autoTable(this.doc, {
            startY: invY,
            head: [[{ content: activo.nombre, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] } }, 'Divisible', 'Detalle', 'Valor Total']],
            body: [
                [
                    { content: 'Resumen del Activo', styles: { fontStyle: 'bold' } },
                    { content: activo.divisible ? 'SÍ' : 'NO' },
                    { content: activo.sub_partidas.length + ' partidas' },
                    { content: this.formatCurrency(total), styles: { fontStyle: 'bold' } }
                ],
                ...rows
            ] as any,
            headStyles: { fillColor: this.primaryColor as any },
            theme: 'grid',
            styles: { fontSize: 8 },
            margin: { left: 15, right: 15 }
        });

        invY = (this.doc as any).lastAutoTable.finalY + 10;
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

        // Group assets by name and sum values/fractions
        const groupedActivos: Record<string, { valor: number, fraccion: number }> = {};
        lote.activos.forEach(item => {
            if (!groupedActivos[item.nombre]) {
                groupedActivos[item.nombre] = { valor: 0, fraccion: 0 };
            }
            groupedActivos[item.nombre].valor += item.valor;
            groupedActivos[item.nombre].fraccion += item.fraccion;
        });

        const loteBody = Object.entries(groupedActivos).map(([nombre, data]) => [
            nombre,
            `${(data.fraccion * 100).toFixed(2)}%`,
            this.formatCurrency(data.valor)
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
        this.addFooter(); // Footer before page break
        this.doc.addPage();
        currentY = 20;
    }
    this.addSectionTitle("4. Memoria Explicativa", currentY);
    currentY += 10;
    
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(30, 41, 59); // slate-800
    const splitText = this.doc.splitTextToSize(data.textoExplicativo, 180);
    this.doc.text(splitText, 15, currentY);

    // NUEVO APARTADO: DESGLOSE POR ACTIVO
    this.addAssetBreakdownSection(data);

    // ANEXO FISCAL & CONSEJOS (New Page)
    if (data.fiscal || data.config) {
        this.addLegalAdvicePage(data);
    }

    // Final Footer
    this.addFooter();

    // Save
    this.doc.save(`Informe_Particion_${data.config.fecha.replace(/\//g, '-')}.pdf`);
  }

  private addLegalAdvicePage(data: ReportData) {
    this.doc.addPage();
    this.addHeader("Guía de Consejos y Marco Legal", "Información Técnica Verificada");
    
    let y = 50;
    this.addSectionTitle("1. Consideraciones Legales", y);
    y += 10;
    
    const advice = [
      { t: "Renuncia a la Herencia", d: "La renuncia debe ser siempre pura, simple y gratuita. Si se renuncia a favor de alguien, se considera donación y tributa doblemente." },
      { t: "Cuentas Bancarias", d: "Las entidades bancarias bloquean las cuentas al fallecimiento. Es necesario presentar el Impuesto de Sucesiones liquidado para desbloquearlas." },
      { t: "Registro de la Propiedad", d: "La inscripción no es obligatoria para heredar pero sí para vender o solicitar hipotecas sobre el bien adjudicado." },
      { t: "Plazos Fiscales", d: "Dispone de 6 meses desde el fallecimiento para liquidar el Impuesto de Sucesiones (con posibilidad de prórroga de otros 6 meses)." }
    ];

    advice.forEach(item => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10);
      this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
      this.doc.text(item.t, 15, y);
      y += 5;
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(71, 85, 105);
      const lines = this.doc.splitTextToSize(item.d, 180);
      this.doc.text(lines, 15, y);
      y += (lines.length * 5) + 5;
    });

    if (data.fiscal && (data.fiscal.colacion.length > 0 || data.fiscal.usufructo.enabled)) {
      this.addSectionTitle("2. Desglose de Operaciones Particionales", y);
      y += 10;

      if (data.fiscal.usufructo.enabled) {
        const uPorc = Math.max(10, Math.min(70, 89 - data.fiscal.usufructo.edadViudo));
        this.doc.setFontSize(9);
        this.doc.setTextColor(30, 41, 59);
        this.doc.text(`USUFRUCTO VIUDAL (${uPorc}%): Aplicado según la regla del 89.`, 15, y);
        y += 5;
        this.doc.setFontSize(8);
        this.doc.setTextColor(100, 116, 139);
        this.doc.text(`Valoración estimada del derecho de uso: ${this.formatCurrency(data.fiscal.usufructo.valor)}`, 15, y);
        y += 10;
      }

      if (data.fiscal.colacion.length > 0) {
        const colBody = data.fiscal.colacion.map(c => [c.concepto, this.formatCurrency(c.valor)]);
        autoTable(this.doc, {
          startY: y,
          head: [['Concepto Colacionable (Donación)', 'Importe']],
          body: colBody,
          theme: 'striped',
          headStyles: { fillColor: [180, 180, 180] },
          margin: { left: 15 }
        });
      }
    }
  }

  private drawDistributionChart(data: ReportData, y: number) {
    const centerX = 160;
    const centerY = y + 25;
    const radius = 20;
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.text("DISTRIBUCIÓN PATRIMONIAL", 15, y + 5);
    
    // Draw a simple stacked bar instead of pie for compatibility and clarity
    let currentX = 15;
    const totalW = 120;
    const h = 8;
    
    data.reparto.lotes.forEach((lote, i) => {
        const totalPatrimonio = data.reparto.lotes.reduce((sum, l) => sum + l.valorBienes, 0);
        const porc = (lote.valorBienes / totalPatrimonio) * 100;
        const w = (totalW * porc) / 100;
        
        // Pick a color
        const colors = [
          [79, 70, 229], [147, 51, 234], [236, 72, 153], [249, 115, 22], [34, 197, 94], [59, 130, 246]
        ];
        const color = colors[i % colors.length];
        
        this.doc.setFillColor(color[0], color[1], color[2]);
        this.doc.rect(currentX, y + 10, w, h, 'F');
        
        // Legend
        this.doc.rect(15, y + 25 + (i * 5), 3, 3, 'F');
        this.doc.setFontSize(7);
        this.doc.setTextColor(71, 85, 105);
        this.doc.text(`${lote.nombreHeredero}: ${porc.toFixed(2)}%`, 20, y + 27.5 + (i * 5));
        
        currentX += w;
    });
    
    this.doc.setDrawColor(226, 232, 240);
    this.doc.rect(15, y + 10, totalW, h, 'S');
  }

  private addFooter() {
    const pageCount = (this.doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        this.doc.setPage(i);
        this.doc.setFontSize(8);
        this.doc.setTextColor(148, 163, 184); // slate-400
        this.doc.setFont('helvetica', 'normal');
        
        // Horizontal line
        this.doc.setDrawColor(241, 245, 249); // slate-100
        this.doc.setLineWidth(0.2);
        this.doc.line(15, 285, 195, 285);
        
        this.doc.text(`Herencia Justa AI - Informe Técnico`, 15, 290);
        this.doc.text(`Página ${i} de ${pageCount}`, 195, 290, { align: 'right' });
    }
  }

  private addAssetBreakdownSection(data: ReportData) {
    this.doc.addPage();
    this.addHeader("Anexo: Desglose de Propiedad por Activo", "Detalle de copropiedad y proindivisos");
    
    let currentY = 50;

    data.inventario.forEach((activo) => {
        // Encontrar todos los herederos que tienen este activo
        const participantes: any[] = [];
        const valorTotalOriginal = activo.sub_partidas.reduce((a, b) => a + (b.cantidad * b.valor_unitario), 0);

        data.reparto.lotes.forEach(lote => {
            const items = lote.activos.filter(a => a.nombre === activo.nombre && !a.virtual);
            if (items.length > 0) {
                const valorAcumulado = items.reduce((sum, i) => sum + i.valor, 0);
                const fraccionAcumulada = items.reduce((sum, i) => sum + i.fraccion, 0);
                participantes.push([
                    lote.nombreHeredero,
                    `${(fraccionAcumulada * 100).toFixed(2)}%`,
                    this.formatCurrency(valorAcumulado)
                ]);
            }
        });

        if (participantes.length > 0) {
            // Check page break
            if (currentY > 240) {
                this.doc.addPage();
                currentY = 20;
            }

            this.doc.setFontSize(11);
            this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(activo.nombre, 15, currentY);
            
            this.doc.setFontSize(9);
            this.doc.setTextColor(100, 116, 139);
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(`Valor de referencia: ${this.formatCurrency(valorTotalOriginal)}`, 140, currentY);

            autoTable(this.doc, {
                startY: currentY + 4,
                head: [['Partícipe / Copropietario', '% de Propiedad', 'Valor Adjudicado']],
                body: participantes,
                theme: 'grid',
                headStyles: { fillColor: [71, 85, 105] },
                styles: { fontSize: 9 },
                margin: { left: 15, right: 15 }
            });

            currentY = (this.doc as any).lastAutoTable.finalY + 12;
        }
    });

    if (data.inventario.length === 0) {
        this.doc.text("No hay activos físicos registrados.", 15, currentY);
    }
  }
}
