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
  gastosEspeciales?: number;
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
  idHeredero?: number;
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
    inheritanceTitle?: string;
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
    comunidadAutonoma?: string;
    porcentajeImpuestoEstimado?: number;
  };
  liquidez?: {
    gastosGenerales: number;
    gastosActivos: number;
    totalGastosEstimados: number;
    efectivoDisponibleTotal: number;
    balanceLiquidez: number;
    balancePorHeredero?: number;
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

  private addHeader(title: string, subtitle?: string, sessionCode?: string, sessionUrl?: string) {
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

    // Code in Header (Top Right)
    if (sessionCode && sessionCode !== "PENDIENTE") {
        const boxX = 150;
        const boxY = 5;
        const boxW = 45;
        const boxH = 30;

        // Transparent/Light box effect
        this.doc.setDrawColor(255, 255, 255);
        this.doc.setLineWidth(0.5);
        this.doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'S');

        this.doc.setFontSize(7);
        this.doc.setTextColor(255, 255, 255);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text("CÓDIGO RECUPERACIÓN", boxX + (boxW / 2), boxY + 6, { align: 'center' });

        this.doc.setFontSize(12);
        this.doc.setFont('courier', 'bold');
        this.doc.text(sessionCode, boxX + (boxW / 2), boxY + 15, { align: 'center' });

        // Session Online Button/Link area
        const btnY = boxY + 20;
        const btnH = 6;
        const btnW = boxW - 10;
        const btnX = boxX + 5;

        this.doc.setFillColor(255, 255, 255, 0.2); // Semi-transparent white
        this.doc.roundedRect(btnX, btnY, btnW, btnH, 1, 1, 'F');
        
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text("SESIÓN ONLINE", boxX + (boxW / 2), btnY + 4, { align: 'center' });

        // Make entire area clickable
        if (sessionUrl) {
            this.doc.link(boxX, boxY, boxW, boxH, { url: sessionUrl });
        }
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
    this.addHeader("Informe Técnico de Partición", subtitle, data.config.sessionCode, data.config.sessionUrl);

    let y = 50;

    // INHERITANCE TITLE (Centered in the body)
    if (data.config.inheritanceTitle) {
        this.doc.setFontSize(24);
        this.doc.setTextColor(51, 65, 85); // Slate 700
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(data.config.inheritanceTitle, 105, y + 10, { align: 'center' });
        y += 30;
    } else {
         y += 10;
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
        
        // Dynamic height check for asset table
        // Header (7) + Summary Row (7) + Rows (7 each) + Padding (10)
        const estHeight = (activo.sub_partidas.length + 2) * 7 + 10;
        if (invY + estHeight > 275) {
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
            head: [[{ content: activo.nombre, styles: { fillColor: [241, 245, 249], textColor: [30, 41, 59] } }, 'Detalle', 'Valor Total']],
            body: [
                [
                    { content: 'Resumen del Activo', styles: { fontStyle: 'bold' } },
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
        // Group assets for height calculation
        const groupedForHeight: Record<string, any> = {};
        lote.activos.forEach(item => {
            groupedForHeight[item.nombre] = true;
        });
        const numAssetRows = Object.keys(groupedForHeight).length;
        const numLiquidityRows = (data.liquidez && lote.idHeredero !== -1) ? 4 : 0;
        
        // Title (10) + Table Header (10) + Rows (7 each) + Padding (15)
        const estHeight = 20 + (numAssetRows + numLiquidityRows) * 7 + 15;

        if (currentY + estHeight > 275) {
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

        const loteBody: any[] = Object.entries(groupedActivos).map(([nombre, data]) => [
            nombre,
            `${(data.fraccion * 100).toFixed(2)}%`,
            this.formatCurrency(data.valor)
        ]);

        if (data.liquidez && lote.idHeredero !== -1) {
            const cashAssigned = lote.activos
                .filter(a => a.nombre === "Caja / Dinero en Efectivo" && a.tipo !== 'gananciales')
                .reduce((sum, a) => sum + a.valor, 0);
            
            const expensePerHeir = data.liquidez.totalGastosEstimados / (data.config.numHerederos || 1);
            
            // Find compensation for this heir
            const compensacion = data.reparto.compensaciones.find(c => c.heredero === lote.id);
            const compensacionAmount = compensacion ? compensacion.diferencia : 0;
            
            const netLiquidity = cashAssigned - expensePerHeir + compensacionAmount;

             loteBody.push(
                ['', '', ''], // Spacer
                [{ content: 'Adjudicación Líquida', styles: { fontStyle: 'italic', textColor: [100, 116, 139], fontSize: 8 } }, '', { content: `+${this.formatCurrency(cashAssigned)}`, styles: { fontSize: 8 } }],
                [{ content: 'Gasto Proporcional', styles: { fontStyle: 'italic', textColor: [220, 38, 38], fontSize: 8 } }, '', { content: `-${this.formatCurrency(expensePerHeir)}`, styles: { fontSize: 8, textColor: [220, 38, 38] } }]
            );
            
            // Add compensation row if exists
            if (compensacionAmount !== 0) {
                loteBody.push(
                    [{ 
                        content: 'Compensación Económica', 
                        styles: { 
                            fontStyle: 'italic', 
                            textColor: compensacionAmount > 0 ? [22, 163, 74] : [220, 38, 38], 
                            fontSize: 8 
                        } 
                    }, '', { 
                        content: `${compensacionAmount > 0 ? '+' : ''}${this.formatCurrency(compensacionAmount)}`, 
                        styles: { 
                            fontSize: 8, 
                            textColor: compensacionAmount > 0 ? [22, 163, 74] : [220, 38, 38] 
                        } 
                    }]
                );
            }
            
            loteBody.push(
                [
                    { 
                        content: netLiquidity >= 0 ? 'LIQUIDEZ NETA' : 'APORTACIÓN NECESARIA', 
                        styles: { fontStyle: 'bold', textColor: netLiquidity >= 0 ? [22, 163, 74] : [220, 38, 38] } 
                    }, 
                    '', 
                    { 
                        content: this.formatCurrency(netLiquidity), 
                        styles: { fontStyle: 'bold', textColor: netLiquidity >= 0 ? [22, 163, 74] : [220, 38, 38] } 
                    }
                ]
            );
        }

        autoTable(this.doc, {
            startY: currentY + 5,
            head: [['Activo Adjudicado', '% Propiedad', 'Valor']],
            body: loteBody,
            theme: 'striped',
            headStyles: { fillColor: [100, 116, 139] },
            margin: { left: 20 }
        });

        currentY = (this.doc as any).lastAutoTable.finalY + 5;
        
        // Add Cuota Individual box (only for non-spouse heirs)
        if (lote.idHeredero !== -1) {
            const boxX = 20;
            const boxY = currentY;
            const boxW = 170;
            const boxH = 10;
            
            // Draw rounded rectangle box
            this.doc.setFillColor(224, 231, 255); // indigo-50
            this.doc.setDrawColor(165, 180, 252); // indigo-200
            this.doc.setLineWidth(0.3);
            this.doc.roundedRect(boxX, boxY, boxW, boxH, 2, 2, 'FD');
            
            // Add label
            this.doc.setFontSize(8);
            this.doc.setTextColor(79, 70, 229); // indigo-600
            this.doc.setFont('helvetica', 'bold');
            this.doc.text('CUOTA INDIVIDUAL', boxX + 3, boxY + 6);
            
            // Add value
            this.doc.setFontSize(9);
            this.doc.setTextColor(67, 56, 202); // indigo-700
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(this.formatCurrency(data.metricas.cuotaIdeal), boxX + boxW - 3, boxY + 6, { align: 'right' });
            
            currentY += boxH + 10;
        } else {
            currentY += 10;
        }
    });

    // COMPENSACIONES
    if (currentY > 240) {
        this.doc.addPage();
        currentY = 20;
    }
    this.addSectionTitle("3. Compensaciones económicas", currentY);
    
    // Filtrar quienes pagan y cobran
    const debenPagar = data.reparto.compensaciones.filter(c => c.diferencia < -0.01);
    const debenCobrar = data.reparto.compensaciones.filter(c => c.diferencia > 0.01);
    
    if (debenPagar.length > 0) {
        currentY += 10;
        this.doc.setFontSize(9);
        this.doc.setTextColor(71, 85, 105);
        this.doc.setFont('helvetica', 'normal');
        const explanationText = "El reparto de bienes queda equilibrado mediante compensaciones económicas. Los herederos con exceso de adjudicación compensan a aquellos con déficit hasta alcanzar la cuota ideal.";
        const splitExplanation = this.doc.splitTextToSize(explanationText, 180);
        this.doc.text(splitExplanation, 15, currentY);
        currentY += splitExplanation.length * 5 + 5;
        
        // Create detailed payment matrix
        const paymentMatrix: { from: string, to: string, amount: number }[] = [];
        
        // Simple distribution: each payer pays proportionally to each receiver
        const totalToPay = debenPagar.reduce((sum, p) => sum + Math.abs(p.diferencia), 0);
        const totalToReceive = debenCobrar.reduce((sum, r) => sum + r.diferencia, 0);
        
        debenPagar.forEach(payer => {
            const payerAmount = Math.abs(payer.diferencia);
            
            debenCobrar.forEach(receiver => {
                const receiverProportion = receiver.diferencia / totalToReceive;
                const payment = payerAmount * receiverProportion;
                
                if (payment > 0.01) {
                    paymentMatrix.push({
                        from: payer.nombreHeredero,
                        to: receiver.nombreHeredero,
                        amount: payment
                    });
                }
            });
        });
        
        // Display payment matrix
        const paymentBody = paymentMatrix.map(p => [
            p.from,
            '→',
            p.to,
            this.formatCurrency(p.amount)
        ]);
        
        autoTable(this.doc, {
            startY: currentY,
            head: [['Pagador', '', 'Receptor', 'Importe']],
            body: paymentBody,
            headStyles: { fillColor: this.secondaryColor as any },
            columnStyles: {
                1: { halign: 'center', cellWidth: 10 }
            },
            margin: { left: 15 }
        });

        currentY = (this.doc as any).lastAutoTable.finalY + 10;
        
        // Summary table
        this.doc.setFontSize(9);
        this.doc.setTextColor(100, 116, 139);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text("Resumen de Compensaciones:", 15, currentY);
        currentY += 5;
        
        const compBody = [
            ...debenPagar.map(c => [{ content: c.nombreHeredero, styles: { textColor: [220, 38, 38] } }, 'PAGA (Exceso)', { content: this.formatCurrency(Math.abs(c.diferencia)), styles: { textColor: [220, 38, 38] } }]),
            ...debenCobrar.map(c => [{ content: c.nombreHeredero, styles: { textColor: [22, 163, 74] } }, 'RECIBE (Déficit)', { content: this.formatCurrency(c.diferencia), styles: { textColor: [22, 163, 74] } }])
        ];

        autoTable(this.doc, {
            startY: currentY,
            head: [['Heredero', 'Concepto', 'Importe']],
            body: compBody as any,
            headStyles: { fillColor: [71, 85, 105] },
            styles: { fontSize: 8 },
            margin: { left: 15 }
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
    
    // Reset font styles to ensure clean text
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    this.doc.setTextColor(30, 41, 59); // slate-800

    const splitText = this.doc.splitTextToSize(data.textoExplicativo, 180);
    this.doc.text(splitText, 15, currentY);
    
    // Calcular la altura real del texto añadido para actualizar currentY
    // aprox 5 puntos por línea en tamaño 10 (con interlineado estándar de jsPDF)
    const textHeight = splitText.length * 5; 
    currentY += textHeight + 10; // +10 de margen extra

    // NUEVO APARTADO: LIQUIDEZ Y GASTOS
    if (data.liquidez) {
        // Ya no usamos lastAutoTable.finalY porque venimos de una sección de texto (seccion 4)
        // Usamos el currentY calculado acumulativamente
        currentY += 10;

        if (currentY > 230) {
            this.doc.addPage();
            currentY = 20;
        }
        this.addSectionTitle("5. Análisis de Liquidez y Gastos de Adjudicación", currentY);
        currentY += 10;

        const diffPerHeir = data.liquidez.balancePorHeredero || (data.liquidez.balanceLiquidez / (data.config.numHerederos || 1));

        const liqBody = [
            ['1. Efectivo / Caja Disponible en Herencia', this.formatCurrency(data.liquidez.efectivoDisponibleTotal)],
            ['2. Gastos Estimados Generales (Impuestos CCAA + Gestión)', this.formatCurrency(data.liquidez.gastosGenerales)],
            ['3. Impuestos/Gastos Específicos sobre Activos', this.formatCurrency(data.liquidez.gastosActivos)],
            ['TOTAL ESTIMADO DE GASTOS', { content: this.formatCurrency(data.liquidez.totalGastosEstimados), styles: { fontStyle: 'bold', textColor: [220, 38, 38] } }]
        ];

        autoTable(this.doc, {
            startY: currentY + 5,
            body: liqBody as any,
            theme: 'plain',
            styles: { fontSize: 9 },
            columnStyles: { 1: { halign: 'right' } }
        });
        
        currentY = (this.doc as any).lastAutoTable.finalY + 10;
        this.doc.setFontSize(8);
        this.doc.setTextColor(100, 116, 139);
        this.doc.text("* Esta estimación es meramente informativa basada en los valores declarados y las medias de la CCAA seleccionada.", 15, currentY);
    }

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
    const margin = 15;
    const totalWidth = 180;
    
    // 1. GRÁFICO DE DISTRIBUCIÓN PATRIMONIAL (Stacked Bar)
    this.doc.setFontSize(9);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text("DISTRIBUCIÓN PATRIMONIAL REAL", margin, y + 5);
    
    let currentX = margin;
    const barWidth = 120;
    const barHeight = 6;
    
    const colors = [
      [79, 70, 229], [147, 51, 234], [236, 72, 153], [249, 115, 22], [34, 197, 94], [59, 130, 246]
    ];
    
    data.reparto.lotes.forEach((lote, i) => {
        const totalAdjudicado = data.reparto.lotes.reduce((sum, l) => sum + l.valorBienes, 0);
        const porc = (lote.valorBienes / totalAdjudicado) * 100;
        const w = (barWidth * porc) / 100;
        
        const color = colors[i % colors.length];
        this.doc.setFillColor(color[0], color[1], color[2]);
        this.doc.rect(currentX, y + 8, w, barHeight, 'F');
        
        // Legend
        this.doc.rect(margin, y + 20 + (i * 5), 3, 3, 'F');
        this.doc.setFontSize(7);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(71, 85, 105);
        this.doc.text(`${lote.nombreHeredero}: ${porc.toFixed(1)}% (${this.formatCurrency(lote.valorBienes)})`, margin + 5, y + 22.5 + (i * 5));
        
        currentX += w;
    });
    
    this.doc.setDrawColor(226, 232, 240);
    this.doc.rect(margin, y + 8, barWidth, barHeight, 'S');

    // 2. GRÁFICO DE EQUIDAD (Bar Chart Comparisons)
    // Mostramos la Cuota Ideal vs Realidad para demostrar transparencia
    const eqX = margin + barWidth + 15;
    const eqMaxH = 25;
    const eqW = 40;
    
    this.doc.setFontSize(9);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text("EQUIDAD DE ADJUDICACIÓN", eqX, y + 5);
    
    // Draw target line (Cuota Ideal)
    this.doc.setDrawColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.setLineWidth(0.1);
    this.doc.line(eqX, y + 10 + eqMaxH, eqX + eqW, y + 10 + eqMaxH); // Base
    
    const subBarW = eqW / data.reparto.lotes.length;
    data.reparto.lotes.forEach((lote, i) => {
        const ratio = Math.min(1.2, lote.valorBienes / (data.metricas.cuotaIdeal || 1));
        const h = eqMaxH * ratio;
        
        const color = colors[i % colors.length];
        this.doc.setFillColor(color[0], color[1], color[2], 0.6); // Slightly transparent
        this.doc.rect(eqX + (i * subBarW) + 1, y + 10 + (eqMaxH - h), subBarW - 2, h, 'F');
    });

    // Label for target
    this.doc.setFontSize(6);
    this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
    this.doc.text("OBJETIVO EQUIDAD 100%", eqX, y + 10 + eqMaxH + 3);
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
    this.addHeader("ANEXO: Hoja de Ruta para Copropietarios", "Guía de gestión para bienes en proindiviso");
    
    let currentY = 50;
    
    this.doc.setFontSize(10);
    this.doc.setTextColor(71, 85, 105);
    const intro = "Este anexo detalla los bienes que han quedado en situación de proindiviso (propiedad compartida). A continuación se proponen pautas para su administración y posible liquidación futura.";
    this.doc.text(this.doc.splitTextToSize(intro, 180), 15, currentY);
    currentY += 15;

    let hayProindivisos = false;

    data.inventario.forEach((activo) => {
        const participantes: any[] = [];
        const valorTotalOriginal = activo.sub_partidas.reduce((a, b) => a + (b.cantidad * b.valor_unitario), 0);

        data.reparto.lotes.forEach(lote => {
            const items = lote.activos.filter(a => a.nombre === activo.nombre && !a.virtual);
            if (items.length > 0) {
                const fraccionAcumulada = items.reduce((sum, i) => sum + i.fraccion, 0);
                if (fraccionAcumulada > 0) {
                    participantes.push({
                        nombre: lote.nombreHeredero,
                        porcentaje: `${(fraccionAcumulada * 100).toFixed(2)}%`,
                        valor: this.formatCurrency(items.reduce((sum, i) => sum + i.valor, 0)),
                        fraccion: fraccionAcumulada
                    });
                }
            }
        });

        // Solo mostrar si hay más de un propietario o si el propietario único no tiene el 100% (caso raro pero posible)
        if (participantes.length > 1) {
            hayProindivisos = true;
            if (currentY > 220) {
                this.doc.addPage();
                currentY = 20;
            }

            this.doc.setFillColor(241, 245, 249);
            this.doc.roundedRect(15, currentY, 180, 8, 1, 1, 'F');
            this.doc.setFontSize(11);
            this.doc.setTextColor(this.primaryColor[0], this.primaryColor[1], this.primaryColor[2]);
            this.doc.setFont('helvetica', 'bold');
            this.doc.text(`BIEN COMPARTIDO: ${activo.nombre}`, 20, currentY + 5.5);
            
            currentY += 12;

            autoTable(this.doc, {
                startY: currentY,
                head: [['Copropietario', '% Participación', 'Valor Adjudicado']],
                body: participantes.map(p => [p.nombre, p.porcentaje, p.valor]),
                theme: 'grid',
                headStyles: { fillColor: [71, 85, 105] },
                styles: { fontSize: 9 },
                margin: { left: 15, right: 15 }
            });

            currentY = (this.doc as any).lastAutoTable.finalY + 8;
            
            // Hoja de ruta recomendada para este bien
            this.doc.setFontSize(9);
            this.doc.setFont('helvetica', 'bold');
            this.doc.setTextColor(30, 41, 59);
            this.doc.text("Hoja de Ruta de Liquidez:", 15, currentY);
            currentY += 5;
            
            this.doc.setFont('helvetica', 'normal');
            this.doc.setFontSize(8);
            this.doc.setTextColor(100, 116, 139);
            const pasos = [
                "1. Pacto de administración: Acordar quién gestionará el mantenimiento y pago de IBI/Tasas.",
                "2. Valoración de mercado: En caso de venta, encargar una tasación externa para evitar conflictos.",
                "3. Derecho de adquisición preferente: Cualquier heredero puede comprar la parte de los demás.",
                "4. Extinción de condominio: Si no hay acuerdo, se puede solicitar la división judicial o subasta."
            ];
            pasos.forEach(p => {
                this.doc.text(p, 20, currentY);
                currentY += 4;
            });

            currentY += 10;
        }
    });

    if (!hayProindivisos) {
        this.doc.setFont('helvetica', 'italic');
        this.doc.text("No se han detectado activos en situación de proindiviso significativo.", 15, currentY);
    }
  }
}
