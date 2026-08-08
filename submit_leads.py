import urllib.request
import urllib.error
import json
import random
import time

url = 'https://fenixconcursosmilitares.com.br/orcm/lp-a/lead'
headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    'Referer': 'https://fenixconcursosmilitares.com.br/orcm/lp-a?ref=T7D5VV6',
    'Origin': 'https://fenixconcursosmilitares.com.br'
}

first_names = ["Marco", "Antonio", "Felipe", "Lucas", "Gabriel", "Maria", "Eduarda", "Ana", "Carolina", "Pedro", "Henrique", "Joao", "Victor", "Rafael", "Carlos", "Thiago", "Beatriz", "Mariana", "Fernanda"]
last_names = ["Silva", "Oliveira", "Santos", "Costa", "Souza", "Ferreira", "Alves", "Lima", "Gomes", "Rocha", "Ribeiro", "Martins", "Carvalho", "Melo", "Barbosa", "Nunes", "Dias", "Cardoso", "Teixeira"]

print("Starting submission of 15 test leads...")

for i in range(15):
    nome = f"{random.choice(first_names)} {random.choice(last_names)}"
    email = f"teste.{nome.replace(' ', '.').lower()}.{random.randint(1000, 9999)}@gmail.com"
    wpp = f"119{random.randint(10000000, 99999999)}"
    
    data = {
        "nome": nome,
        "email": email,
        "whatsapp": wpp,
        "origem": "captura",
        "utm_source": "",
        "utm_medium": "",
        "utm_campaign": "",
        "utm_content": "",
        "utm_term": "",
        "fbclid": "",
        "referrer": "",
        "landing_url": "https://fenixconcursosmilitares.com.br/orcm/lp-a?ref=T7D5VV6",
        "ref": "T7D5VV6"
    }
    
    req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers, method='POST')
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode('utf-8')
            print(f"[{i+1}/15] Success: {nome} | {email} -> {res_data}")
    except urllib.error.HTTPError as e:
        err_msg = ""
        try:
            err_msg = e.read().decode('utf-8')
        except:
            pass
        print(f"[{i+1}/15] HTTP Error {e.code}: {err_msg}")
    except Exception as e:
        print(f"[{i+1}/15] Error: {e}")
        
    time.sleep(0.5)

print("Done!")
