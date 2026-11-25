import { useMemo } from 'react';
import { Globe2, Lock, MapPin, ShieldCheck } from 'lucide-react';
import { useChurchAuth } from '../../context/ChurchDataContext';
import { AdminPanelHeader } from './AdminSharedUI';

function toMillis(ts: unknown): number | null {
  if (!ts) return null;
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
    const fn = (ts as { toMillis?: () => number }).toMillis;
    if (typeof fn === 'function') {
      const ms = fn.call(ts);
      return Number.isFinite(ms) ? ms : null;
    }
  }
  if (typeof ts === 'object' && ts !== null && 'seconds' in ts) {
    const sec = Number((ts as { seconds?: unknown }).seconds);
    return Number.isFinite(sec) ? sec * 1000 : null;
  }
  if (typeof ts === 'number' && Number.isFinite(ts)) {
    return ts;
  }
  return null;
}

function formatDateTime(ts: unknown): string {
  const ms = toMillis(ts);
  if (ms === null) return '刚刚记录';
  return new Date(ms).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface RegionStatRow {
  key: string;
  country: string;
  region: string;
  count: number;
  latestMs: number;
  latestRaw: unknown;
}

interface CountryStatRow {
  country: string;
  count: number;
}

export function AdminVisitorStatsPanel() {
  const { canViewVisitorStats, isMainAdmin, visitorStats, visitorIpRecords } = useChurchAuth();

  const { todayCount, weekCount, monthCount, countryStats, regionStats, totalSampleCount } =
    useMemo(() => {
      const now = Date.now();
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const todayMs = startOfToday.getTime();
      const sevenDaysMs = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysMs = now - 30 * 24 * 60 * 60 * 1000;

      let today = 0;
      let week = 0;
      let month = 0;

      const countryMap = new Map<string, number>();
      const regionMap = new Map<string, RegionStatRow>();

      for (const rec of visitorIpRecords) {
        const ms = toMillis(rec.countedAt);
        if (ms !== null) {
          if (ms >= todayMs) today += 1;
          if (ms >= sevenDaysMs) week += 1;
          if (ms >= thirtyDaysMs) month += 1;
        }

        const hasCountry = Boolean(rec.country && rec.country.trim());
        const hasRegion = Boolean(rec.region && rec.region.trim());
        const country = hasCountry ? rec.country!.trim() : '历史访问（未采集地区）';
        const region = hasRegion
          ? rec.region!.trim()
          : hasCountry
            ? '未知省份/州'
            : '再次访问后自动补全';

        countryMap.set(country, (countryMap.get(country) ?? 0) + 1);

        const regionKey = `${country}__${region}`;
        const existing = regionMap.get(regionKey);
        const recMs = ms ?? 0;
        if (existing) {
          existing.count += 1;
          if (recMs > existing.latestMs) {
            existing.latestMs = recMs;
            existing.latestRaw = rec.countedAt;
          }
        } else {
          regionMap.set(regionKey, {
            key: regionKey,
            country,
            region,
            count: 1,
            latestMs: recMs,
            latestRaw: rec.countedAt,
          });
        }
      }

      const sortedCountries: CountryStatRow[] = Array.from(countryMap.entries())
        .map(([country, count]) => ({ country, count }))
        .sort((a, b) => b.count - a.count);

      const sortedRegions: RegionStatRow[] = Array.from(regionMap.values()).sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return b.latestMs - a.latestMs;
      });

      return {
        todayCount: today,
        weekCount: week,
        monthCount: month,
        countryStats: sortedCountries,
        regionStats: sortedRegions,
        totalSampleCount: visitorIpRecords.length,
      };
    }, [visitorIpRecords]);

  if (!canViewVisitorStats) {
    return (
      <div className="bg-white border border-[#E5DFD3] rounded-lg p-8 text-center space-y-3">
        <Lock className="w-8 h-8 text-[#9A3412] mx-auto" />
        <h2 className="font-editorial text-xl font-semibold text-[#1C1917]">
          暂无访客统计查看权限
        </h2>
        <p className="text-xs text-[#57534E] max-w-md mx-auto leading-relaxed">
          访客计数明细与 IP 归属地统计仅限主管理员或已单独授予「访客统计查看权限」的同工查阅。如需开通，请联系教会主管理员在「来访留言与权限」中授权。
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <AdminPanelHeader
        title="独立访客统计数据"
        description="基于同 IP 仅计一次的去重计数统计，按来访 IP 归属地汇总至国家与省份/大区；原始 IP 全程经过 SHA-256 哈希脱敏处理，不入库保存。"
      />

      {/* Permission & De-identification Notice */}
      <div className="bg-[#F3EFE6]/70 border border-[#DFD8C8] rounded-lg p-4 flex items-start gap-3 text-xs text-[#292524]">
        <ShieldCheck className="w-4 h-4 text-[#1E3A5F] shrink-0 mt-0.5" />
        <div className="space-y-1 leading-relaxed">
          <p className="font-medium text-[#1C1917]">
            权限与隐私保护状态：{isMainAdmin ? '主管理员（全权查看）' : '已获授权查看访客统计'}
          </p>
          <p className="text-[#57534E]">
            来访者在打开页面时，服务端在内存中解析国家与省份归属地，并对来访 IP 执行 SHA-256 单向哈希脱敏去重；数据库仅保存脱敏哈希键与归属地（国家、省份），全程不存储任何原始 IP 地址。
          </p>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E5DFD3] rounded-lg p-5">
          <p className="text-xs text-[#78716C] mb-1">累计独立访客</p>
          <p className="font-editorial text-3xl font-semibold text-[#1E3A5F] tabular-nums">
            {visitorStats ? visitorStats.totalVisitors : 0}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">
            最近更新：{visitorStats?.updatedAt ? formatDateTime(visitorStats.updatedAt) : '暂无记录'}
          </p>
        </div>

        <div className="bg-white border border-[#E5DFD3] rounded-lg p-5">
          <p className="text-xs text-[#78716C] mb-1">今日新增独立 IP</p>
          <p className="font-editorial text-3xl font-semibold text-[#1C1917] tabular-nums">
            {todayCount}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">同一 IP 当日重复访问不复计</p>
        </div>

        <div className="bg-white border border-[#E5DFD3] rounded-lg p-5">
          <p className="text-xs text-[#78716C] mb-1">近 7 天新增独立 IP</p>
          <p className="font-editorial text-3xl font-semibold text-[#1C1917] tabular-nums">
            {weekCount}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">基于最近 {totalSampleCount} 条去重样本</p>
        </div>

        <div className="bg-white border border-[#E5DFD3] rounded-lg p-5">
          <p className="text-xs text-[#78716C] mb-1">覆盖国家/地区数</p>
          <p className="font-editorial text-3xl font-semibold text-[#1C1917] tabular-nums">
            {countryStats.length}
          </p>
          <p className="text-[11px] text-[#78716C] mt-1">
            近 30 天新增独立 IP：{monthCount}
          </p>
        </div>
      </div>

      {/* Country Summary Strip */}
      {countryStats.length > 0 && (
        <div className="bg-white border border-[#E5DFD3] rounded-lg p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-medium text-[#1C1917]">
            <Globe2 className="w-4 h-4 text-[#1E3A5F]" />
            <span>按国家/地区汇总分布</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {countryStats.map((item) => {
              const pct =
                totalSampleCount > 0 ? Math.round((item.count / totalSampleCount) * 100) : 0;
              return (
                <div
                  key={item.country}
                  className="bg-[#FAF8F4] border border-[#EFEAE0] rounded-md px-4 py-3 flex items-center justify-between gap-3 text-xs"
                >
                  <span className="font-medium text-[#1C1917] truncate">{item.country}</span>
                  <span className="font-mono text-[#1E3A5F] font-semibold tabular-nums shrink-0">
                    {item.count} 次 ({pct}%)
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Detailed Country & Province/Region Breakdown */}
      <div className="bg-white border border-[#E5DFD3] rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-[#EFEAE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-editorial text-lg font-semibold text-[#1C1917] flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#1E3A5F]" />
              <span>按 IP 归属地统计访问次数（国家 / 省份）</span>
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              按国家/地区与省份（大区/州）汇总独立访客访问次数（同一 IP 仅计 1 次，共统计 {totalSampleCount} 条去重记录）
            </p>
          </div>
        </div>

        {regionStats.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-[#78716C]">
            暂无归属地访问统计。访客打开教会官网首页后，系统将自动完成归属地解析与同 IP 去重计数。
          </div>
        ) : (
          <div className="divide-y divide-[#EFEAE0]">
            {regionStats.map((row, index) => {
              const pct =
                totalSampleCount > 0 ? Math.round((row.count / totalSampleCount) * 100) : 0;
              return (
                <div
                  key={row.key}
                  className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono text-[11px] text-[#78716C] tabular-nums w-7 shrink-0">
                      #{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-[#1C1917]">{row.country}</span>
                        <span className="text-[#A8A29E]">/</span>
                        <span className="font-medium text-[#1E3A5F]">{row.region}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full max-w-xs bg-[#EFEAE0] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#1E3A5F] rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(4, pct)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 pl-10 md:pl-0 shrink-0">
                    <span className="font-mono text-[11px] text-[#78716C] tabular-nums">
                      最近访问：{formatDateTime(row.latestRaw)}
                    </span>
                    <div className="text-right min-w-[76px]">
                      <span className="font-mono text-sm font-semibold text-[#1C1917] tabular-nums">
                        {row.count}
                      </span>
                      <span className="text-[#57534E] ml-1">次</span>
                      <span className="text-[11px] text-[#78716C] ml-1.5 tabular-nums">
                        ({pct}%)
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
