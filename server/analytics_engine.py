#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Motor Analítico em Python para Auditoria Trabalhista e Conformidade CLT.
Processa 100% dos dados de funcionários e marcações sem amostragem.
Fornece cálculos determinísticos de regras CLT e pontuação de risco.
"""

import sys
import json
import math
from datetime import datetime, timedelta

# Feriados nacionais brasileiros recorrentes (MM-DD)
FERIADOS_NACIONAIS = {
    '01-01',  # Confraternização Universal
    '04-21',  # Tiradentes
    '05-01',  # Dia do Trabalho
    '09-07',  # Independência do Brasil
    '10-12',  # Nossa Senhora Aparecida
    '11-02',  # Finados
    '11-15',  # Proclamação da República
    '12-25'   # Natal
}


def time_to_minutes(time_str: str) -> int:
    if not time_str:
        return 0
    parts = time_str.split(':')
    hrs = int(parts[0]) if len(parts) > 0 and parts[0].isdigit() else 0
    mins = int(parts[1]) if len(parts) > 1 and parts[1].isdigit() else 0
    return hrs * 60 + mins


def minutes_to_time_str(total_minutes: float) -> str:
    tm = int(math.floor(total_minutes))
    hrs = tm // 60
    mins = tm % 60
    return f"{hrs:02d}:{mins:02d}"


def diff_hours(start: str, end: str) -> float:
    m_start = time_to_minutes(start)
    m_end = time_to_minutes(end)
    if m_end < m_start:
        return (m_end + 1440 - m_start) / 60.0
    return (m_end - m_start) / 60.0


def is_sunday(date_str: str) -> bool:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.weekday() == 6
    except Exception:
        return False


def is_saturday(date_str: str) -> bool:
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d")
        return dt.weekday() == 5
    except Exception:
        return False


def is_holiday(date_str: str) -> bool:
    if len(date_str) >= 10:
        mm_dd = date_str[5:10]
        return mm_dd in FERIADOS_NACIONAIS
    return False


def calcular_horas_noturnas(inicio: str, fim: str) -> float:
    m_start = time_to_minutes(inicio)
    m_end = time_to_minutes(fim)
    if m_end < m_start:
        m_end += 1440

    limite_inicio = 22 * 60  # 1320 min
    limite_fim = 5 * 60      # 300 min

    minutos_noturnos = 0
    for m in range(m_start, m_end):
        m_norm = m % 1440
        if m_norm >= limite_inicio or m_norm < limite_fim:
            minutos_noturnos += 1

    if minutos_noturnos == 0:
        return 0.0

    horas_fisicas = minutos_noturnos / 60.0
    return horas_fisicas * 1.142857  # Fator fictício CLT (60 / 52.5)


def is_true_val(val) -> bool:
    if val is True:
        return True
    s = str(val).strip().lower()
    return s in ('true', '1', 'sim', 'yes')


def is_marcacao_valida(m: dict) -> bool:
    if not m:
        return False

    tipo = str(m.get('tipo', '')).upper()
    if tipo not in ('ENTRADA', 'SAIDA'):
        return False

    origem = str(m.get('origem', '')).upper()
    if any(k in origem for k in ('FOLGA', 'DSR', 'FERIA', 'AFAST', 'ABONO', 'EVENTO ADMINISTRATIVO')):
        return False

    if is_true_val(m.get('desprezado')) or is_true_val(m.get('desprezada')):
        return False

    status = str(m.get('status', '')).upper()
    desc = str(m.get('descricao', '')).upper()
    if 'DESPREZAD' in status or 'DESPREZAD' in desc:
        return False

    return True


def is_dia_trabalhado(day_puncs: list) -> bool:
    if not day_puncs:
        return False
    return any(is_marcacao_valida(m) for m in day_puncs)


def resolver_e_consolidar_vinculos(funcionarios: list) -> dict:
    todos = funcionarios or []
    if not todos:
        return {"ativos": [], "todos": [], "mapaHistoricoParaAtivo": {}}

    cpf_map = {}
    for f in todos:
        cpf = str(f.get('cpf', '')).strip().replace('.', '').replace('-', '')
        if not cpf:
            continue
        if cpf not in cpf_map:
            cpf_map[cpf] = []
        cpf_map[cpf].append(f)

    ativos = []
    mapa_hist_ativo = {}

    for cpf, grupo in cpf_map.items():
        if not grupo:
            continue
        # Encontra o vínculo ativo mais recente ou o primeiro
        ativo = None
        for item in grupo:
            st = str(item.get('status', '')).upper()
            sit = str(item.get('situacao', '')).upper()
            if st == 'ATIVO' or sit == 'ATIVO':
                ativo = item
                break
        if not ativo:
            ativo = grupo[0]

        ativos.append(ativo)

        for item in grupo:
            mapa_hist_ativo[str(item.get('id'))] = str(ativo.get('id'))

    # Para funcionários sem CPF
    for f in todos:
        fid = str(f.get('id'))
        if fid not in mapa_hist_ativo:
            mapa_hist_ativo[fid] = fid
            st = str(f.get('status', '')).upper()
            sit = str(f.get('situacao', '')).upper()
            if st == 'ATIVO' or sit == 'ATIVO':
                if f not in ativos:
                    ativos.append(f)

    return {
        "ativos": ativos,
        "todos": todos,
        "mapaHistoricoParaAtivo": mapa_hist_ativo
    }


def processar_auditoria(funcionarios: list, marcacoes: list) -> dict:
    jornadas = []
    ocorrencias = []

    consolidacao = resolver_e_consolidar_vinculos(funcionarios)
    target_funcs = consolidacao["ativos"] if len(consolidacao["ativos"]) > 0 else consolidacao["todos"]
    mapa_hist = consolidacao["mapaHistoricoParaAtivo"]

    marcacoes_por_func = {}
    for m in (marcacoes or []):
        fid = str(m.get('funcionarioId', ''))
        active_id = mapa_hist.get(fid, fid)
        data = str(m.get('data', ''))

        if active_id not in marcacoes_por_func:
            marcacoes_por_func[active_id] = {}
        if data not in marcacoes_por_func[active_id]:
            marcacoes_por_func[active_id][data] = []

        m_copy = dict(m)
        m_copy['funcionarioId'] = active_id
        marcacoes_por_func[active_id][data].append(m_copy)

    for func in target_funcs:
        fid = str(func.get('id'))
        func_name = str(func.get('nome', 'Sem Nome'))
        func_matr = str(func.get('matricula', ''))
        func_dept = str(func.get('departamento', ''))
        func_sexo = str(func.get('sexo', 'MASCULINO'))

        func_marc_data = marcacoes_por_func.get(fid, {})
        datas_com_marc = sorted(list(func_marc_data.keys()))

        jornadas_func = []

        for index, data in enumerate(datas_com_marc):
            valid_puncs = [p for p in func_marc_data.get(data, []) if is_marcacao_valida(p)]
            valid_puncs.sort(key=lambda x: str(x.get('hora', '')))

            clean_puncs = []
            for p in valid_puncs:
                if not clean_puncs:
                    clean_puncs.append(p)
                else:
                    last_time = str(clean_puncs[-1].get('hora', ''))[:5]
                    curr_time = str(p.get('hora', ''))[:5]
                    if time_to_minutes(curr_time) - time_to_minutes(last_time) >= 1:
                        clean_puncs.append(p)

            times = [str(p.get('hora', ''))[:5] for p in clean_puncs if str(p.get('hora', ''))]

            primeira_entrada = times[0] if len(times) > 0 else None
            ultima_saida = times[-1] if len(times) > 1 else None

            minutos_trabalhados = 0
            horas_noturnas = 0.0
            intervalo_realizado = 0

            tipo_dia = 'UTIL'
            if is_holiday(data):
                tipo_dia = 'FERIADO'
            elif is_sunday(data):
                tipo_dia = 'DOMINGO'
            elif is_saturday(data):
                tipo_dia = 'SABADO'

            # Quantidade ímpar
            if len(times) % 2 != 0:
                ocorrencias.append({
                    "id": f"oc_{fid}_{data}_impar",
                    "funcionarioId": fid,
                    "funcionarioNome": func_name,
                    "funcionarioMatricula": func_matr,
                    "funcionarioDepartamento": func_dept,
                    "funcionarioSexo": func_sexo,
                    "data": data,
                    "tipo": "MARCACAO_IMPAR",
                    "descricao": f"Quantidade ímpar de marcações registradas ({len(times)} batidas): [{', '.join(times)}]. Possível esquecimento.",
                    "gravidade": "MEDIO",
                    "valorConstatado": f"{len(times)} batidas",
                    "valorPermitido": "Pares"
                })

            if len(times) >= 2:
                # Turnos
                for i in range(0, len(times) - 1, 2):
                    e = times[i]
                    s = times[i + 1]
                    if e and s:
                        m_start = time_to_minutes(e)
                        m_end = time_to_minutes(s)
                        if m_end < m_start:
                            m_end += 1440
                        minutos_trabalhados += (m_end - m_start)
                        horas_noturnas += calcular_horas_noturnas(e, s)

                horas_trabalhadas = minutos_trabalhados / 60.0

                # Intervalos
                intervalos = []
                for i in range(1, len(times) - 1, 2):
                    s = times[i]
                    e = times[i + 1]
                    if s and e:
                        int_min = time_to_minutes(e) - time_to_minutes(s)
                        intervalos.append(max(0, int_min))

                intervalo_realizado = max(intervalos) if intervalos else 0

                # Regra: Jornada >= 10h (Art. 59) -> 600 minutos
                if minutos_trabalhados >= 600:
                    excesso_min = minutos_trabalhados - 600
                    gravidade = "MEDIO"
                    if minutos_trabalhados > 840:
                        gravidade = "CRITICO"
                    elif minutos_trabalhados > 720:
                        gravidade = "ALTO"

                    ocorrencias.append({
                        "id": f"oc_{fid}_{data}_jornada_exc",
                        "funcionarioId": fid,
                        "funcionarioNome": func_name,
                        "funcionarioMatricula": func_matr,
                        "funcionarioDepartamento": func_dept,
                        "funcionarioSexo": func_sexo,
                        "data": data,
                        "tipo": "JORNADA_EXCESSIVA",
                        "descricao": f"Jornada excessiva registrada de {minutes_to_time_str(minutos_trabalhados)}. Excedeu o limite legal em {minutes_to_time_str(excesso_min)}.",
                        "gravidade": gravidade,
                        "valorConstatado": f"{minutes_to_time_str(minutos_trabalhados)}",
                        "valorPermitido": "10:00"
                    })

                # Regra: Intervalo Intrajornada (Art. 71)
                if horas_trabalhadas > 6.0:
                    if len(times) == 2:
                        ocorrencias.append({
                            "id": f"oc_{fid}_{data}_sem_intervalo",
                            "funcionarioId": fid,
                            "funcionarioNome": func_name,
                            "funcionarioMatricula": func_matr,
                            "funcionarioDepartamento": func_dept,
                            "funcionarioSexo": func_sexo,
                            "data": data,
                            "tipo": "INTERVALO_INSUFICIENTE",
                            "descricao": f"Jornada longa de {minutes_to_time_str(horas_trabalhadas * 60)} sem registro de intervalo intrajornada. Risco grave de reincorporação de hora extra fictícia.",
                            "gravidade": "CRITICO",
                            "valorConstatado": "0 min",
                            "valorPermitido": "60 min"
                        })
                    elif intervalo_realizado < 55:
                        grav = "CRITICO" if intervalo_realizado < 30 else "ALTO"
                        ocorrencias.append({
                            "id": f"oc_{fid}_{data}_int_insuficiente",
                            "funcionarioId": fid,
                            "funcionarioNome": func_name,
                            "funcionarioMatricula": func_matr,
                            "funcionarioDepartamento": func_dept,
                            "funcionarioSexo": func_sexo,
                            "data": data,
                            "tipo": "INTERVALO_INSUFICIENTE",
                            "descricao": f"Intervalo para repouso ou alimentação de apenas {intervalo_realizado} minutos. CLT exige no mínimo 60 minutos para jornadas acima de 6h.",
                            "gravidade": grav,
                            "valorConstatado": f"{intervalo_realizado} min",
                            "valorPermitido": "60 min"
                        })
                elif 4.0 < horas_trabalhadas <= 6.0:
                    if len(times) == 2:
                        ocorrencias.append({
                            "id": f"oc_{fid}_{data}_sem_int_medio",
                            "funcionarioId": fid,
                            "funcionarioNome": func_name,
                            "funcionarioMatricula": func_matr,
                            "funcionarioDepartamento": func_dept,
                            "funcionarioSexo": func_sexo,
                            "data": data,
                            "tipo": "INTERVALO_INSUFICIENTE",
                            "descricao": f"Jornada de {minutes_to_time_str(horas_trabalhadas * 60)} sem intervalo para repouso. Exigido no mínimo 15 minutos.",
                            "gravidade": "MEDIO",
                            "valorConstatado": "0 min",
                            "valorPermitido": "15 min"
                        })
                    elif intervalo_realizado < 12:
                        ocorrencias.append({
                            "id": f"oc_{fid}_{data}_int_medio_ins",
                            "funcionarioId": fid,
                            "funcionarioNome": func_name,
                            "funcionarioMatricula": func_matr,
                            "funcionarioDepartamento": func_dept,
                            "funcionarioSexo": func_sexo,
                            "data": data,
                            "tipo": "INTERVALO_INSUFICIENTE",
                            "descricao": f"Intervalo para repouso de apenas {intervalo_realizado} minutos. Exigido no mínimo 15 minutos para jornadas de 4h a 6h.",
                            "gravidade": "ALTO",
                            "valorConstatado": f"{intervalo_realizado} min",
                            "valorPermitido": "15 min"
                        })

                # Regra: Domingo excessivo (> 6h no domingo)
                if tipo_dia == 'DOMINGO' and horas_trabalhadas > 6.0:
                    grav = "CRITICO" if horas_trabalhadas > 8.0 else "ALTO"
                    ocorrencias.append({
                        "id": f"oc_{fid}_{data}_dom_exc",
                        "funcionarioId": fid,
                        "funcionarioNome": func_name,
                        "funcionarioMatricula": func_matr,
                        "funcionarioDepartamento": func_dept,
                        "funcionarioSexo": func_sexo,
                        "data": data,
                        "tipo": "DOMINGO_EXCESSIVO",
                        "descricao": f"Trabalho excessivo no domingo registrado de {minutes_to_time_str(horas_trabalhadas * 60)}. Excedeu o limite prudencial operacional de 6h.",
                        "gravidade": grav,
                        "valorConstatado": f"{minutes_to_time_str(horas_trabalhadas * 60)}",
                        "valorPermitido": "06:00"
                    })

            # Interjornada
            descanso_interjornada = None
            if index > 0 and primeira_entrada:
                data_anterior = datas_com_marc[index - 1]
                jornada_ant = next((j for j in jornadas_func if j['data'] == data_anterior), None)

                if jornada_ant and jornada_ant.get('ultimaSaida'):
                    try:
                        dt_s = datetime.strptime(f"{data_anterior} {jornada_ant['ultimaSaida']}:00", "%Y-%m-%d %H:%M:%S")
                        dt_e = datetime.strptime(f"{data} {primeira_entrada}:00", "%Y-%m-%d %H:%M:%S")
                        diff_sec = (dt_e - dt_s).total_seconds()
                        if diff_sec > 0:
                            descanso_interjornada = diff_sec / 3600.0
                            if descanso_interjornada < 11.0:
                                grav = "CRITICO" if descanso_interjornada < 9.0 else "ALTO"
                                desc_min = int(round(descanso_interjornada * 60))
                                desc_fmt = minutes_to_time_str(desc_min)

                                dt_ant_fmt = datetime.strptime(data_anterior, "%Y-%m-%d").strftime("%d/%m/%Y")
                                dt_atual_fmt = datetime.strptime(data, "%Y-%m-%d").strftime("%d/%m/%Y")

                                ocorrencias.append({
                                    "id": f"oc_{fid}_{data}_interjornada",
                                    "funcionarioId": fid,
                                    "funcionarioNome": func_name,
                                    "funcionarioMatricula": func_matr,
                                    "funcionarioDepartamento": func_dept,
                                    "funcionarioSexo": func_sexo,
                                    "data": data,
                                    "tipo": "INTERJORNADA_INSUFICIENTE",
                                    "descricao": f"Descanso interjornada inferior a 11h. Detalhamento: Data da jornada anterior: {dt_ant_fmt}, Horário de saída anterior: {jornada_ant.get('ultimaSaida', 'S/M')}, Data da jornada atual: {dt_atual_fmt}, Horário de entrada atual: {primeira_entrada or 'S/M'}, Quantidade de horas apuradas: {desc_fmt}.",
                                    "gravidade": grav,
                                    "valorConstatado": desc_fmt,
                                    "valorPermitido": "11:00"
                                })
                    except Exception:
                        pass

            jornada_obj = {
                "id": f"jorn_{fid}_{data}",
                "funcionarioId": fid,
                "data": data,
                "primeiraEntrada": primeira_entrada,
                "ultimaSaida": ultima_saida,
                "marcações": times,
                "horasTrabalhadas": horas_trabalhadas,
                "horasNoturnas": horas_noturnas,
                "horasTrabalhadasFormat": minutes_to_time_str(horas_trabalhadas * 60),
                "intervaloRealizado": intervalo_realizado,
                "descansoInterjornada": descanso_interjornada,
                "tipoDia": tipo_dia
            }

            jornadas_func.append(jornada_obj)
            jornadas.append(jornada_obj)

        # Regra: Streak de 7 Dias sem Folga
        if datas_com_marc:
            dias_seguidos = 0
            data_inicio_streak = ""

            try:
                loop_dt = datetime.strptime(datas_com_marc[0], "%Y-%m-%d")
                max_dt = datetime.strptime(datas_com_marc[-1], "%Y-%m-%d")

                while loop_dt <= max_dt:
                    loop_str = loop_dt.strftime("%Y-%m-%d")
                    day_puncs = func_marc_data.get(loop_str, [])
                    trabalhado = is_dia_trabalhado(day_puncs)

                    if trabalhado:
                        if dias_seguidos == 0:
                            data_inicio_streak = loop_str
                        dias_seguidos += 1

                        if dias_seguidos >= 7:
                            ocorrencias = [o for o in ocorrencias if o.get('id') != f"oc_{fid}_streak_{data_inicio_streak}"]
                            ocorrencias.append({
                                "id": f"oc_{fid}_streak_{data_inicio_streak}",
                                "funcionarioId": fid,
                                "funcionarioNome": func_name,
                                "funcionarioMatricula": func_matr,
                                "funcionarioDepartamento": func_dept,
                                "funcionarioSexo": func_sexo,
                                "data": loop_str,
                                "tipo": "SEM_FOLGA_7_DIAS",
                                "descricao": f"Trabalho s/ Folga 7 Dias: prestou trabalho efetivo por {dias_seguidos} dias consecutivos.",
                                "gravidade": "CRITICO" if dias_seguidos >= 8 else "ALTO",
                                "valorConstatado": f"{dias_seguidos} dias",
                                "valorPermitido": "6 dias"
                            })
                    else:
                        dias_seguidos = 0

                    loop_dt += timedelta(days=1)
            except Exception:
                pass

        # Regra: Dois Domingos Seguidos Trabalhados
        domingos_trabalhados = [d for d in datas_com_marc if is_sunday(d) and is_dia_trabalhado(func_marc_data.get(d, []))]
        for dom1 in domingos_trabalhados:
            try:
                dt1 = datetime.strptime(dom1, "%Y-%m-%d")
                dt2 = dt1 + timedelta(days=7)
                dom2 = dt2.strftime("%Y-%m-%d")

                if is_dia_trabalhado(func_marc_data.get(dom2, [])):
                    ocorrencias.append({
                        "id": f"oc_{fid}_dom_seg_{dom1}",
                        "funcionarioId": fid,
                        "funcionarioNome": func_name,
                        "funcionarioMatricula": func_matr,
                        "funcionarioDepartamento": func_dept,
                        "funcionarioSexo": func_sexo,
                        "data": dom2,
                        "tipo": "DOMINGOS_SEGUIDOS",
                        "descricao": f"Trabalho em Domingos Seguidos: o colaborador trabalhou em dois domingos consecutivos ({dt1.strftime('%d/%m/%Y')} e {dt2.strftime('%d/%m/%Y')}) sem o descanso dominical previsto na CLT.",
                        "gravidade": "ALTO",
                        "valorConstatado": "2 domingos",
                        "valorPermitido": "1 domingo"
                    })
            except Exception:
                pass

    return {
        "jornadas": jornadas,
        "ocorrencias": ocorrencias
    }


def calcular_scores_funcionarios(funcionarios: list, ocorrencias: list) -> list:
    ocorrencias_por_func = {}
    for oc in (ocorrencias or []):
        fid = str(oc.get('funcionarioId', ''))
        if fid not in ocorrencias_por_func:
            ocorrencias_por_func[fid] = []
        ocorrencias_por_func[fid].append(oc)

    res = []
    for f in (funcionarios or []):
        fid = str(f.get('id', ''))
        ocs = ocorrencias_por_func.get(fid, [])

        total_pontos = 0
        for o in ocs:
            grav = str(o.get('gravidade', '')).upper()
            if grav == 'CRITICO':
                total_pontos += 25
            elif grav == 'ALTO':
                total_pontos += 10
            elif grav == 'MEDIO':
                total_pontos += 4
            else:
                total_pontos += 1

        score_risco = min(total_pontos, 100)
        grau_risco = 'BAIXO'
        if score_risco >= 50:
            grau_risco = 'CRITICO'
        elif score_risco >= 25:
            grau_risco = 'ALTO'
        elif score_risco >= 10:
            grau_risco = 'MEDIO'

        f_copy = dict(f)
        f_copy['scoreRisco'] = score_risco
        f_copy['grauRisco'] = grau_risco
        res.append(f_copy)

    return res


def main():
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            sys.exit(1)

        payload = json.loads(input_data)
        funcionarios = payload.get("funcionarios", [])
        marcacoes = payload.get("marcacoes", [])

        audit_result = processar_auditoria(funcionarios, marcacoes)
        jornadas = audit_result["jornadas"]
        ocorrencias = audit_result["ocorrencias"]

        funcs_atualizados = calcular_scores_funcionarios(funcionarios, ocorrencias)

        out_payload = {
            "status": "success",
            "jornadas": jornadas,
            "ocorrencias": ocorrencias,
            "funcionariosAtualizados": funcs_atualizados,
            "engine": "python3"
        }

        sys.stdout.write(json.dumps(out_payload, ensure_ascii=False))
        sys.stdout.flush()

    except Exception as e:
        err_payload = {
            "status": "error",
            "message": str(e)
        }
        sys.stderr.write(json.dumps(err_payload))
        sys.exit(1)


if __name__ == "__main__":
    main()
