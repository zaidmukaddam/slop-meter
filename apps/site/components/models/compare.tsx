import { GROUPS, MODELS } from "@/lib/models"

export function Compare() {
  return (
    <table className="w-full border-separate border-spacing-0 text-sm">
      <caption className="sr-only">
        The standard model and sharper reading, measurement by measurement
      </caption>
      <colgroup>
        <col className="w-[46%] sm:w-[40%]" />
        <col className="w-[27%] sm:w-[30%]" />
        <col className="w-[27%] sm:w-[30%]" />
      </colgroup>
      <thead>
        <tr className="sticky top-0 z-10 bg-bench">
          <th scope="col" className="border-b border-etch py-4 pr-3 text-left">
            <span className="legend text-[10px] font-semibold text-graphite">
              Measure
            </span>
          </th>
          {MODELS.map((model) => (
            <th
              key={model.id}
              scope="col"
              className="border-b border-etch py-4 pl-3 text-left align-bottom"
            >
              <span className="block text-base font-semibold tracking-[-0.01em]">
                {model.name}
              </span>
              <span className="mt-1 block text-[11px] font-normal text-graphite">
                {model.role}
              </span>
            </th>
          ))}
        </tr>
      </thead>
      {GROUPS.map((group) => (
        <tbody key={group.id}>
          <tr>
            <th
              scope="colgroup"
              colSpan={3}
              className="legend pt-10 pb-3 text-left text-[10px] font-semibold text-graphite"
            >
              {group.label}
            </th>
          </tr>
          {group.rows.map((row) => (
            <tr key={row.name} className="align-baseline">
              <th
                scope="row"
                className="border-t border-hairline py-4 pr-3 text-left font-normal text-pretty"
              >
                {row.name}
                {row.note && (
                  <span className="mt-1.5 block max-w-sm text-[13px]/relaxed text-graphite">
                    {row.note}
                  </span>
                )}
              </th>
              {row.values.map((value, i) => (
                <td
                  key={MODELS[i].id}
                  className="border-t border-hairline py-4 pl-3 font-mono text-[13px] tabular-nums"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}
