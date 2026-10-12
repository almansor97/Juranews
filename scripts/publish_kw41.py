import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts = ["eu","bfh1","bfh2","bag9","bag166","bverwg-short","bverwg9","bgh","bsg-a","bsg6"]
raw = sum((json.loads((root/"data"/"staging"/f"2026-W41-{x}.json").read_text()) for x in parts), [])
assert len(raw) == 16 and len({x["id"] for x in raw}) == 16
areas = ["Zivilrecht","Strafrecht","Öffentliches Recht","Arbeitsrecht","Sozialrecht","Steuerrecht","Europarecht"]
counts = {a:sum(x["area"]==a for x in raw) for a in areas}
assert all(counts[a] for a in areas if a != "Strafrecht")
assert all("2026-10-05" <= x["pub"] <= "2026-10-11" for x in raw)
def convert(x):
    return dict(id=x["id"],court=x["court"],senate=x.get("senate",""),
        date=x["date"],docket=x["docket"],area=x["area"],
        title=x["title"],holding=x["holding"],summary=x["holding"],
        facts=x["facts"],reasons=x["reasons"],significance=x["holding"],
        exam_relevance=x["exam"],publication_date=x["pub"],
        citation=x.get("citation",x["docket"]),
        source={"name":"Amtlicher Volltext" if x["full"] else "Amtlicher Nachweis",
                "url":x["url"]},
        fulltext={"available":bool(x["full"]),"url":x["url"],
                  "label":"Volltext öffnen" if x["full"] else "Amtlichen Nachweis öffnen"},
        detailed_analysis=x["analysis"])
issue={"schema_version":2,"status":"published","issue_label":"KW 41/2026",
       "week":{"from":"2026-10-05","to":"2026-10-11","short":"KW 41",
               "title":"Ausgabe KW 41 · 5.–11. Oktober 2026"},
       "intro":"16 verifizierte Entscheidungen und neu verfügbare Gründe. Alle Reiter außer Strafrecht sind vertreten.",
       "week_summary":"Europarecht, Zivilrecht, Arbeitsrecht, Sozialrecht, Steuerrecht und Öffentliches Recht.",
       "methodology":"Einzelrecherche je Rechtsgebiet; maßgeblich sind Veröffentlichungsdaten. BGH-PM 189/2026 mangels verifizierter Aktenzeichen- und Begründungsgrundlage nicht aufgenommen. Vorläufige Nachweise sind gekennzeichnet.",
       "quality_checks":{"by_area":counts,"unfilled_areas":["Strafrecht"],
                         "unfilled_reason":"BGH-PM 189/2026 gesichtet, Fallangaben nicht hinreichend verifiziert."},
       "decisions":[convert(x) for x in raw]}
latest=root/"data"/"latest.json"
assert json.loads(latest.read_text())["week"]["from"]=="2026-09-28"
archive=root/"data"/"archive"/"2026-W40.json"
assert json.loads(archive.read_text())["week"]["from"]=="2026-09-28"
latest.write_text(json.dumps(issue,ensure_ascii=False,indent=2)+"\n")
index=root/"data"/"archive"/"index.json"
j=json.loads(index.read_text())
j["issues"]=[{"week":"2026-W40","label":"KW 40/2026","date":"2026-10-04",
              "path":"data/archive/2026-W40.json"}]+[x for x in j["issues"] if x["week"]!="2026-W40"]
index.write_text(json.dumps(j,ensure_ascii=False,indent=2)+"\n")
print(len(raw),counts)
