# -*- coding: utf-8 -*-
"""Motor de categorização — regras partilhadas entre o build (Python) e a app (JS).

Ordem: comerciante conhecido (pesquisa/conhecimento) -> regras por palavra-chave
-> heurísticas genéricas. Tudo case-insensitive.
"""

# ---------------------------------------------------------------- comerciantes
# Identificados por pesquisa online ou conhecimento directo. Prefixo do nome
# normalizado (sem "COMPRA" nem referência de cartão), comparado sem maiúsculas.
MERCHANTS = {
    # --- pesquisados (negócios locais) ---
    "CME CANIDELO": "Saúde e farmácia",          # Centro Médico de Canidelo
    "CEPI": "Saúde e farmácia",                   # clínica de estética/implantes
    "BRIGHTGLOW": "Saúde e farmácia",
    "INTENSE HAND": "Saúde e farmácia",           # manicure
    "OCCASION2SMILE": "Compras online",           # loja de cosmética coreana
    "IDIOTA": "Restauração e cafés",              # Idiota Casa Portuense, Porto
    "ARCADIA": "Restauração e cafés",             # Arcádia, chocolataria/café
    "SERRA ROXO": "Restauração e cafés",
    "SERRA & ROXO": "Restauração e cafés",
    "XOXO": "Restauração e cafés",
    "LETRARIA": "Restauração e cafés",            # Letraria, cerveja artesanal
    "BOSCO": "Restauração e cafés",
    "EPICURA": "Restauração e cafés",
    "TETTRIS": "Restauração e cafés",
    "NINKI": "Restauração e cafés",               # sushi
    "ANGULO MESTR": "Restauração e cafés",
    "CAPICCIA": "Restauração e cafés",
    "MANUEL RUI A": "Restauração e cafés",        # Delta Cafés (Manuel Rui Azinhais Nabeiro)
    "NOMADAS": "Lazer e noite",
    "DONA MIRA": "Lazer e noite",
    "ROMANOFF": "Lazer e noite",
    "ERA UMA VEZ": "Lazer e noite",
    "FERRO BAR": "Lazer e noite",
    "MIRA JAZZ": "Lazer e noite",
    "FIASCO": "Lazer e noite",
    "PLANO B": "Lazer e noite",
    "CAE S. MAMEDE": "Lazer e noite",             # Centro de Artes e Espectáculos
    "MAKSU": "Transportes",                       # pagamento de estacionamento
    "CARDAN": "Transportes",                      # peças auto
    "UPMAX-GLOBAL": "Viagens",                    # pedido de autorização de viagem
    # --- cadeias e serviços conhecidos ---
    "MANTEIGARIA": "Restauração e cafés",
    "STARBUCKS": "Restauração e cafés",
    "OAKBERRY": "Restauração e cafés",
    "H3 ": "Restauração e cafés",
    "CELEIRO": "Supermercado",
    "PROZIS": "Desporto e ginásio",
    "SWAROVSKI": "Roupa e lojas",
    "PARFOIS": "Roupa e lojas",
    "LOVISA": "Roupa e lojas",
    "CHICCO": "Roupa e lojas",
    "TEA SHOP": "Roupa e lojas",
    "PULL BEAR": "Roupa e lojas",
    "PULL&BEAR": "Roupa e lojas",
    "GOTOGATE": "Viagens",
    "KIWI.COM": "Viagens",
    "DOUBLE TREE": "Viagens",
    "DOUBLETREE": "Viagens",
    "CORINTHIA": "Viagens",
    "PESTANA": "Viagens",
    "JACOBS INN": "Viagens",
    "MS* JACOBSINN": "Viagens",
    "MS JACOBSIN": "Viagens",
    "HBH DUBLIN": "Viagens",
    "TFL TRAVEL": "Transportes",
    "DT DUBLIN": "Transportes",
    "FLIXM": "Transportes",
    "FLIXBUS": "Transportes",
    "SONAR FESTIVAL": "Lazer e noite",
    "RESIDENT ADVIS": "Lazer e noite",
    "GUINNESS STO": "Lazer e noite",
    "GUINNESS SH": "Lazer e noite",
    "CLAUDE.AI": "Subscrições e digital",
    "GOOGLE ONE": "Subscrições e digital",
    "HELP.HBOMAX": "Subscrições e digital",
    "KINDLE": "Subscrições e digital",
    "HOTMART": "Subscrições e digital",
    "UPWORK": "Comissões e taxas",
    "REMOTEJOBS": "Subscrições e digital",
    "LUSITANIA": "Seguros",
    "MAPFRE": "Seguros",
    "MULTICARE": "Seguros",
    # --- lote C (pesquisa) ---
    "ELEBE": "Restauração e cafés",               # éLeBê Centro, Porto
    "HERDADE MALH": "Restauração e cafés",        # Herdade da Malhadinha Nova
    "ESTACAO DAS CO": "Restauração e cafés",      # Estação/Loja das Conservas
    "FAROL IMAGIN": "Restauração e cafés",        # Farol Imaginário
    "TALHASCA": "Restauração e cafés",            # Talhasca Villa Parda, Porto
    "MOMENTS LOUN": "Restauração e cafés",
    "MOMENTS CAFE": "Restauração e cafés",
    "CASA GUEDES": "Restauração e cafés",
    "CABANA DO PAST": "Restauração e cafés",
    "QUIMET": "Restauração e cafés",              # Quimet i Quimet, Barcelona
    "OGHAM": "Restauração e cafés",
    "FRANKFURT": "Restauração e cafés",
    "TEMPLESUHI": "Restauração e cafés",
    "ORIGINE": "Restauração e cafés",
    "LEBILLET": "Lazer e noite",                  # bilheteira online
    "TEELING": "Lazer e noite",                   # Teeling Distillery, Dublin
    "THE ROYAL COCK": "Lazer e noite",
    "ALAMEDA SHOP": "Roupa e lojas",
    "NORTHSPIRIT": "Outras compras",              # gráfica
    # --- inferências de baixa confiança (a app marca para revisão) ---
    "ACPSENHORA": "Seguros",                      # Automóvel Club de Portugal
    "CENTRO SOLDA": "Transportes",
    "PLANETA SIM": "Lazer e noite",
    "TEIXEIRA E MAR": "Restauração e cafés",
    "TEIXEIRA E M": "Restauração e cafés",
    "VERAO UTOPIC": "Lazer e noite",
    "SQ FOURTH": "Restauração e cafés",
    "SQ INDI": "Restauração e cafés",
    "EXUBERPINK": "Saúde e farmácia",
    "CORREIA BRESOL": "Restauração e cafés",
    "REGRAS IDENT": "Impostos e Estado",
    "OP BX VALOR": "Transportes",                 # portagens Via Verde (BX Valor 03)
    # --- cadeias identificadas pelo código de loja ---
    "BK1": "Restauração e cafés",                 # Burger King (código de loja)
    "BK2": "Restauração e cafés",
    "PORTAROSSA": "Restauração e cafés",
    "BLACK PEPPER": "Restauração e cafés",
    "SAMMICH": "Restauração e cafés",
    "HOLY SANDWIC": "Restauração e cafés",
    "SNEAKY SIP": "Restauração e cafés",
    "STREET SMASH": "Restauração e cafés",
    "BROWNIE LOVERS": "Restauração e cafés",
    "TORANJA": "Restauração e cafés",
    "EUPAGO*TORANJA": "Restauração e cafés",
    "EL PATIO": "Restauração e cafés",
    "LOS CAZURROS": "Restauração e cafés",
    "ENTREPENAS": "Restauração e cafés",
    "ALDEANA": "Restauração e cafés",
    "COALLA": "Restauração e cafés",
    "MOLLY LEON": "Lazer e noite",
    "THE ACADEMY": "Lazer e noite",
    "WORLDS END": "Lazer e noite",
    "THE SOCIAL H": "Lazer e noite",
    "T CHAMPIONS": "Lazer e noite",
    "DISC RENDEZ": "Lazer e noite",
    "MONDO DISKO": "Lazer e noite",
    "LUXFRAGIL": "Lazer e noite",
    "EDDIES KLUB": "Lazer e noite",
    "BEER KINGDOM": "Lazer e noite",
    "CATEDRAL DE LE": "Lazer e noite",
    "RECOLETOS": "Lazer e noite",
    "FDN SANTA CA": "Lazer e noite",
    "FUNDACION": "Lazer e noite",
    "MIELE": "Roupa e lojas",
    "LUCIANO ARTE": "Roupa e lojas",
    "PERSONALIZ ART": "Roupa e lojas",
    "ESTANCO": "Outras compras",
    "TABACS": "Outras compras",
}

# ------------------------------------------------------------------- palavras
# (categoria, regex) — avaliadas por ordem, sempre case-insensitive.
KEYWORDS = [
    # rendimentos / movimentos internos primeiro
    ("Rendimentos", r"ORDENADOS|FORNECEDOR\s*-"),
    ("Investimentos", r"\bXTB\b"),
    ("Renda", r"ordem permanente SEPA\+ ?Jorge Pereira"),

    ("Impostos e Estado", r"Pag\. ?DUC|AUTORIDADE TRIBUT|\bIMPOSTO\b|SEG\.? SOCIAL|\bUKVI\b|\bETA\b MOB|FINANCAS"),
    ("Seguros", r"SEGUROS|LUSITANIA|MAPFRE|MULTICARE|FIDELIDADE|ALLIANZ|TRANQUILIDADE|AGEAS"),
    ("Contas da casa", r"AGUAS|GOLD ENERG|NOS COMUNI|\bEDP\b|GALP ENERGIA|ALTICE|\bMEO\b|VODAFONE|\bDIGI\b|IBERDROLA|ENDESA|CONDOMINIO"),
    ("Comissões e taxas", r"Comiss(ã|a)o|COMISS|Imposto do selo|MANUTEN(Ç|C)|ANUIDADE"),
    ("Levantamentos", r"^LEVANT|LEVANTAMENTO|^LEV "),

    ("Supermercado", r"CONTINENTE|PINGO ?DOCE|\bA SUPER\b|INTERMARCHE|ALIADOS SUPERM|\bLIDL\b|MINIPRECO|AUCHAN|MERCADONA|SUPERMERC|FROIZ|\bSPAR\b|MEU SUPER|\bDIA\b|CELEIRO|MERCEARIA|TALHO|PEIXARIA|LOCAL PANTRY|A S FREIXO|A\.?S\.? SANTO TIR|A S AD MIA"),

    # transportes: portagens, combustível, estacionamento, boleias, transportes públicos
    ("Transportes", r"UBER\s*\*?\s*(TRI|BUSINE|ONE)|UBER TRIP|\bUBER\b|\bUBR\*|BOLT\.EU|BOLT\.EUO|FREE ?NOW|\bTAXI\b|CABIFY|"
                    r"\bRNE\b|REDE NAC|REDE EXPRESS|COMBOIOS|\bCP\b|FLIXBUS|FLIXM|ALSA|RENFE|"
                    r"METRO |METROPOLITANO|STCP|CARRIS|TRANSDEV|\bTFL\b|\bMTA\b|"
                    r"^A\d{1,2}\b|PORTAGEM|VIA ?VERDE|BRISA|ASCENDI|"
                    r"GALP\b|\bBP\b|REPSOL|PRIO |CEPSA|CEDIPSA|MOEVE|PETRO|POSTO |ABASTEC|GARAGEM|"
                    r"PARQUE|PARKIN|ESTACION|ESTAC |EMEL|TMP |TFGEST|SABA |EMPARK|MAKSU|^PA [A-Z]|"
                    r"AEROP|AEROPORTO|EA AER|TRANSATEL|MILSERVICE E|CARDAN|OFICINA|PNEUS|INSPE(C|Ç)"),

    ("Viagens", r"BOOKING|BKG\*|AIRBNB|RYANAIR|EASYJET|VUELING|WIZZ|IBERIA|LUFTHANSA|BRITISH AIR|\bTAP\b|"
                r"GOTOGATE|KIWI\.COM|EDREAMS|OPODO|SKYSCANNER|EXPEDIA|FLIGHTS ON|PARTNERS ON BO|"
                r"HOSTEL|\bHOTEL\b|POUSADA|GUEST ?HOUSE|RESIDENCIAL|PESTANA|CORINTHIA|DOUBLE ?TREE|MELIA|NH \b|IBIS\b|"
                r"DUTY ?FRE|DFS|AVOLTA|WH SMITH|HMS HOST|UPMAX|JACOBS ?INN|HbH |M OU CO HOTE"),

    ("Subscrições e digital", r"GOOGLE\*|GOOGLE PLAY|GOOGLE ONE|ANTHROPIC|CLAUDE\.AI|OPENAI|CHATGPT|NETFLIX|SPOTIFY|"
                              r"HBO|HBOMAX|DISNEY|PRIME VID|AMAZON PRIME|HAYSTACK|APPLE\.COM|ICLOUD|YOUTUBE|PATREON|"
                              r"CURSOR|GITHUB|NINTENDO|PLAYSTATION|STEAM|CRUNCHYROLL|VERSAO DIARI|VRSAO DIARIA|"
                              r"KINDLE|AUDIBLE|CANVA|NOTION|DROPBOX|ADOBE|MICROSOFT|LINKEDIN|HOTMART|REMOTEJOBS|SUBSCRI"),

    ("Desporto e ginásio", r"VIVAGYM|SQ ?\*?ADVANCED|\bGYM\b|GINASIO|FITNESS|PADEL|CROSSFIT|PISCINA|CLIMBING|UPACLIMB|DECATHLON|SPORT ZONE|PROZIS|MYPROTEIN"),

    ("Saúde e farmácia", r"FARMACIA|PARAFARM|\bFARM\b|CLINICA|CENTRO MEDICO|\bCME\b|HOSPITAL|DENTIST|DENTAR|MEDIC|"
                         r"ANALISES|LABORATORIO|OPTICA|MULTIOPTICAS|WELL ?S\b|CABELEIREIR|BARBEAR|BARBER|"
                         r"MANICURE|INTENSE HAND|ESTETICA|\bSPA\b|MASSAG|CEPI\b|BRIGHTGLOW"),

    ("Animais", r"ZOOPLUS|PETLANDIA|\bPET\b|PETSHOP|VETERIN|\bVET\b|GENEROSIDADE|ANIMAL"),

    ("Compras online", r"AMAZON|\bAMZN\b|TEMU|VINTED|MGP\*|ALIEXPRESS|\bEBAY\b|SHEIN|\bETSY\b|WISH\.COM|"
                       r"HIPAY|HTTPS HIPA|WORTEN\.PT|FNAC\.PT|OCCASION2SMILE|DSTORE"),

    ("Roupa e lojas", r"\bZARA\b|ZARA\.COM|ZARAPORTO|DRUNI|\bNYX\b|MILSERVI|BERSHKA|PULL ?&? ?BEAR|STRADIVARIUS|"
                      r"\bMANGO\b|\bH&M\b|\bHM PT|PRIMARK|LEROY MERLIN|\bIKEA\b|\bFNAC\b|WORTEN|EL CORTE|\bNORMAL\b|"
                      r"FLYING TIGER|RITUALS|SEPHORA|PERFUM|SWAROVSKI|PARFOIS|LOVISA|CHICCO|TEA SHOP|"
                      r"COSMETIC|PLURICOSMET|AROMAS PRECIOS|LIVRARIA|BERTRAND|FLORISTA|OURIVES|JOALHAR"),

    ("Lazer e noite", r"CINEMA|CINEMAS NOS|NOS ALAMEDA|\bIMAX\b|TEATRO|MUSEU|MUSEUM|GALERIA|EXPO|"
                      r"DISCOTECA|\bDISC\b|\bCLUB\b|\bKLUB\b|NIGHTCLUB|SHOTGUN|DICE\.FM|TICKETLINE|TICKET ?LINE|TICKETS|"
                      r"ENTERTICKET|3CKET|\bBOL\b|BOL\.PT|FEVER|SONAR|FESTIVAL|CONCERT|LIVE |RESIDENT ADVIS|"
                      r"\bPUB\b|\bBAR\b|TABERNA|CERVEJARIA|BREWERY|GUINNESS|TATTOO|KARAOKE|BOWLING|ESTADIO|"
                      r"PLANO B|FERRO BAR|MIRA JAZZ|FIASCO|NOMADAS|DONA MIRA|ROMANOFF|ERA UMA VEZ|CAE S\. MAMEDE|"
                      r"UNDERGROUND|GARE |LUXFRAGIL|MONDO DISKO|EDDIES|CATEDRAL|RECOLETOS|FDN SANTA CA|FUNDACION"),

    ("Restauração e cafés", r"RESTAUR|\bREST|\bCAFE|CAFÉ|CAFETERIA|SNACK|PASTELARIA|PASTEIS|PADARIA|CONFEITARIA|"
                            r"MANTEIGARIA|GELAT|BRUNCH|BISTRO|TASCA|TASQUINHA|TASCO|CHURRAS|MARISQ|PIZZ|BURGER|"
                            r"SUSHI|RAMEN|POKE|KEBAB|TAPAS|TAPERIA|GRILL|\bFOOD\b|EATS|HUNGRY|QUIOSQUE|KIOSK|"
                            r"STARBUCKS|OAKBERRY|ACAI|BREW|COFFEE|BAKERY|SANDWIC|CREPE|DOCE|BROWNIE|"
                            r"BLOOM|AREAS PORTUGAL|BRISA AREAS|IDIOTA|ARCADIA|XOXO|LETRARIA|BOSCO|EPICURA|"
                            r"TETTRIS|NINKI|ANGULO MESTR|CAPICCIA|SERRA ?&? ?ROXO|MANUEL RUI A|H3 |MESA \d|"
                            r"VENDING|MAQ\. |TOPVENDING|CITYVENDING|DECORUM VENDIN"),

    ("Transferências recebidas", r"^IPS/|^TRANSF SEPA|^TRF |^Trf "),
    ("Transferências enviadas", r"^Trf imediata|^Trf MB WAY|^TRF MBW|^TRF ENV|^Trf |MBWAY|MB WAY|^TRANSFER(Ê|E)NCIA|^TRANSF SEPA"),
]

# Categorias que só fazem sentido no sinal indicado ('-' despesa, '+' receita)
SIGN = {
    "Transferências recebidas": "+",
    "Transferências enviadas": "-",
    "Levantamentos": "-",
}
