# Verificación de la Fase 4

Carpeta **Pruebas** (contraseña `prueba123456`): 216 personajes de prueba, uno por subclase (niveles
3/6/10/14/20 rotando), Soulknife, Druida de la Luna y Artificiero (Alchemist) a niveles 3, 5 y 11, un
Paladín de nivel 19 y un Mago de nivel 1. Todos se descifran con la contraseña (con otra no) y su
hoja se calcula sin errores.

Método: se vuelca la hoja calculada de cada personaje y un agente (Sonnet) por clase la compara con
el texto real de `data/classes.json` y `data/subclasses.json`. Los fallos los corrige Opus en el
motor, con tests sobre datos reales.

## Clérigo — 24 personajes: 12 correctos, 12 con fallos

| Fallo | Estado |
| --- | --- |
| Blessed Strikes = Potent Spellcasting seguía mostrando el daño de Divine Strike (7 personajes); lo mismo en Elemental Fury del Druida | ✅ los números de una opción solo salen con esa opción elegida |
| Student of Arcana: 2 trucos de Mago sin selector | ✅ |
| Acolyte of Strength: truco de druida sin selector | ✅ |
| Reaper: truco de nigromancia de cualquier lista sin selector | ✅ (filtro por escuela) |
| Order / Peace: habilidad "(your choice)" sin selector | ✅ |
| Indomitable Defense: 2 resistencias a elegir | ✅ selector y resistencias aplicadas |
| Saint of Forge and Fire: inmunidad al fuego | ✅ las viñetas de una lista de beneficios (sin "elige") se aplican todas |
| Unencumbered Grace: Acrobacias (pericia si ya la tienes) | Pendiente |
| City Domain: competencia con "sidearms" y vehículos terrestres | Pendiente (armas de fuego de homebrew/UA) |

Dudosos (sin cambio): Divine Strike / Potent Spellcasting de 2014 en nivel 17 (decisión de
`dudas.md` #7), herramienta de Blessings of Knowledge, telepatía de Unfettered Mind, Pull of Death y
Balm of Peace sin precalcular.
