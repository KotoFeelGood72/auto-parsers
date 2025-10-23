# 🔑 Настройка GitHub Secrets для CI/CD

## ✅ SSH ключ успешно добавлен на сервер!

Публичный ключ был успешно добавлен на сервер `77.232.138.181` для пользователя `root`.

## 📋 Настройка GitHub Secrets

Теперь нужно добавить следующие секреты в ваш GitHub репозиторий:

### 1. Перейдите в настройки репозитория:
- GitHub → Ваш репозиторий → Settings → Secrets and variables → Actions

### 2. Добавьте следующие секреты:

#### `SERVER_HOST`
```
77.232.138.181
```

#### `SERVER_USER`
```
root
```

#### `SERVER_SSH_KEY`
```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAACFwAAAAdzc2gtcn
NhAAAAAwEAAQAAAgEAtYAYVEbFs1+L9XC0gKOD1pDQsnh56xmKnIt7AljsxrfzMkfZ3wLn
THsSEp42awBkddm4yjZIUFK6gfKRLLfa+eDZ/bYDWl0FApr/HfwnCB8VrgBFOnK8bdKVeB
DCKnpkSIS6h/mxliq2o73WqOw0MAkME5CeSj3gGKJy2YcLXYTWLZ7FxP35dw49RbLTnDO4
c2lAV0DkIDKY9UNtJijP2sFMb2i5oaDtesXgxMYbl1clmRPUyDyxrkZCr/M9Yi/ykmAYly
ieHQHuAJqgvlcWVLdBbPHOc+EOZ6XjROGuNRUD53AUs5Tr7DqLi996yGZVqMkdzGM6/CCh
2N+TsEP1oOwAuWtAcDKTz/Je9wbgTsef8UN++gPULXaIoPxdtPnMe1OlO87gz7VBRxs18T
EiiqnH+6F7tknJfJa7u8GJxqb1IufU/DiU3xsIudsn7mfmvWlbVzwF+zHoeDECQ/90b/Y6
zidnjQS2KgDza53DO10qkJdTagAP0CM/Nh478RjXDswnfVy6BZvcv5DikjmzYits6w+tdl
DLHSzfZYBjuihqEIO3yluSpA7q/3bw5g4Q2HgEWX1WWpFNRtS7EyOX6m8cmT/xvx/txaP5
xgLqBRsjewvcY5HvEhQXuE86y0mi28EdD7OARGX26QCNcwZ7xYlLNKctJ6VVX+dlksu6pC
sAAAdQLSgWBi0oFgYAAAAHc3NoLXJzYQAAAgEAtYAYVEbFs1+L9XC0gKOD1pDQsnh56xmK
nIt7AljsxrfzMkfZ3wLnTHsSEp42awBkddm4yjZIUFK6gfKRLLfa+eDZ/bYDWl0FApr/Hf
wnCB8VrgBFOnK8bdKVeBDCKnpkSIS6h/mxliq2o73WqOw0MAkME5CeSj3gGKJy2YcLXYTW
LZ7FxP35dw49RbLTnDO4c2lAV0DkIDKY9UNtJijP2sFMb2i5oaDtesXgxMYbl1clmRPUyD
yxrkZCr/M9Yi/ykmAYlyieHQHuAJqgvlcWVLdBbPHOc+EOZ6XjROGuNRUD53AUs5Tr7DqL
i996yGZVqMkdzGM6/CCh2N+TsEP1oOwAuWtAcDKTz/Je9wbgTsef8UN++gPULXaIoPxdtP
nMe1OlO87gz7VBRxs18TEiiqnH+6F7tknJfJa7u8GJxqb1IufU/DiU3xsIudsn7mfmvWlb
VzwF+zHoeDECQ/90b/Y6zidnjQS2KgDza53DO10qkJdTagAP0CM/Nh478RjXDswnfVy6BZ
vcv5DikjmzYits6w+tdlDLHSzfZYBjuihqEIO3yluSpA7q/3bw5g4Q2HgEWX1WWpFNRtS7
EyOX6m8cmT/xvx/txaP5xgLqBRsjewvcY5HvEhQXuE86y0mi28EdD7OARGX26QCNcwZ7xY
lLNKctJ6VVX+dlksu6pCsAAAADAQABAAACAQCwMbLslWu1DwsqcIf53ULOF/VRXB1W+ouS
HuGCTNtGqip/5DqAASyTFWJdCpPfWhksQvjd7MZUm4sNPXJrS+xa6UoVvw0QOv7zIY6KCE
/H1Y1RRlfuPpXnsyeA0Bv96qTRtW/zMpWQJtT4rgDmKa8b9pxvndPcVKboo0MFItEIrzzQ
OrLY4oi7Z+pZcBl3KMpl14YrbgZHr3bHmfYqtjHZtg7ClJKocjY4GkJyI7ODPol0SkklPa
5rdS+l6Wbsm4lLSdh1XWvo0we+NF3ZiWdXRDNSVIdL/O3j9qljJAbe5xDMKwUdtHM29zqi
xYdHZfjACsVPtgD7453akGiqE78tHs79IJfN7S56qCYNOChWQoeNub85wHlqaz3vJ+7mSf
AbfV7aQRm39TH7eKnM1C1uFgEUEP+kZovd9XPee7A5crSgutxVDr710fmyQ5EXozzee65e
iRzpjZNXW7Uqo71UDGiWOdT9qBMNJvFKfSqlEy9AqR9/hNiPvF5dzu6EL7ltlRFOEYxiVW
J1KZHFVS+7BJcKqdz9ea/ZJGucJSbbRZwAQb/guoTxy2AVhuKYjeolW3gzVYUTr6hDu9NA
KrTECfGBYE+F01gVVTUnm2Y9zI4mxUdw3NSvulqDVIwoCR0aoFHYnWtvYRQ83PSrBAXICA
vCELNggv3vysSjZ1oXuQAAAQEA1PfPO4yhDcrytq66D+dlrgzkPBAPK7PtjsSx6dvIiwTV
QI2bQfYjcwpPeeTaB6xFQSm4bcW/mm2IIbP+kcTJrUl3ohJ03PbOb9zjRIqOyc8p2yAABK
wvKP/T/ugEvEbZp2/w4nGRIrIFHPj2s78RodHfXOuHBJ2RuSRpGEPeb/edptxfELMPRxzR
TqWnjZh4tVJ61McoFdXBYkrvG3UTcK3bGC2rgzMF2QK1B1wuP/JykiMWTyidY8MN2/aYUb
9bBska32y+27B32yKVTBbcIdXurH3RiS5NhV+ZVIW3iwNQ5+AxeIgjHWdY1wCsR9dPS12b
cRdzYGwZZlDU8ggHhwAAAQEA5LODeWPqQYgtl8/O/5eSb0UwFKozjJ3V6r2GD0INwd2R+y
LrokuggGi2+RwLlYYPAGEpHAKGKpfLs65gV7n+M3b58SV9hXeWpdaVTAdf8zA1U3B6q6vA
ds+5FmT1wsEkBf+pGt69JZi0uMnjUWkylm7T940bquIL8Bf9e998IcjPLYfcfzOU9X8m1s
6mX7UmhS0wb1N2cwFQuqATy7+YS+YnMjf1FVHv8o47zrGWa6pQXWvh40EJGJzBXp+7Pun4
wcENUrrpiR+j0NpV1HyapbmA7MtvWanSnPeMDyr/h8qz0ovcic/Nb3moupLUO9zdrBPZXh
D/Xf1oJVVsDhQI1QAAAQEAyypAgD6vuqZSqMeSrucLJPFbgfOalDgpQueB/jqsCBm0BSFB
g/n0+VNiOQYZAiIjMjP/QQRlDfeOgpPak33cgI3JbIPaUWIxXow1Cy0lbbrJMF7kTsxoKn
wWSLafRPQQpfoNfu1OHnBx1V9o5Pqf0s662yx7AP71edTTF3o3dsHnNtAxAOSNyIdcmks6
rbLTXNBXIjGgheYEtuQNbBZlLZxEpvgNFVUVPqZfYSdgJWfPZUaNBp/YhCdTy30N0qQTGr
LtQG94G6gC/SpzwZ2au7wOzE6quC6JATHADaMcJvd1WUHRajkos4rW+yZUzG2hM85MSXRK
V8qOJEySjBp4/wAAABl2aWtATWFjQm9vay1BaXItVmlrLmxvY2Fs
-----END OPENSSH PRIVATE KEY-----
```

#### `SERVER_PORT` (опционально)
```
22
```

## ✅ Проверка подключения

После добавления секретов, GitHub Actions сможет подключаться к серверу и выполнять автоматический деплой.

## 🚀 Тестирование

1. Сделайте commit и push в main ветку
2. Перейдите в Actions → Deploy to Server
3. Проверьте, что деплой выполняется успешно

## 📝 Примечания

- SSH ключ уже добавлен на сервер
- Директория проекта: `/root/auto-parsers`
- Пользователь: `root`
- IP: `77.232.138.181`

**Готово к автоматическому деплою!** 🎉
