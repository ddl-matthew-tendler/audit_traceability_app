import Highcharts from 'highcharts';

/** Domino accent colors per design system */
export const DOMINO_COLORS = [
  '#543FDE',
  '#0070CC',
  '#28A464',
  '#CCB718',
  '#FF6543',
  '#E835A7',
  '#2EDCC4',
  '#A9734C',
];

/** Apply Domino theme to Highcharts (call once at app init) */
export function applyDominoHighchartsTheme(): void {
  Highcharts.setOptions({
    colors: DOMINO_COLORS,
    time: {
      timezone: undefined,
    },
    chart: {
      style: {
        fontFamily: 'Inter, Lato, Helvetica Neue, Helvetica, Arial, sans-serif',
      },
      backgroundColor: '#FFFFFF',
      borderRadius: 4,
    },
    title: {
      style: { color: '#3F4547' },
    },
    subtitle: {
      style: { color: '#7F8385' },
    },
    xAxis: {
      gridLineColor: '#E0E0E0',
      labels: {
        style: { color: '#65657B' },
      },
      lineColor: '#E0E0E0',
      tickColor: '#E0E0E0',
    },
    yAxis: {
      gridLineColor: '#E0E0E0',
      labels: {
        style: { color: '#65657B' },
      },
      lineColor: '#E0E0E0',
      tickColor: '#E0E0E0',
      title: {
        style: { color: '#3F4547' },
      },
    },
    legend: {
      itemStyle: { color: '#3F4547' },
    },
    tooltip: {
      backgroundColor: '#FFFFFF',
      borderColor: '#E0E0E0',
      style: {
        color: '#3F4547',
      },
    },
  });
}
