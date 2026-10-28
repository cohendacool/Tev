Resources/Favicon.png

## Welcome to Tev!

Tev is a one of a kind AI chatbot with 2 main goals, to excel in tech and to sound very human.

The cool part about Tev compared to many other AIs is simple, Tev is, and will always be, free, with no limits whatsoever, as it is run entirely locally!

And the best part? It's open source. Feel free to edit and distribute this app in any way you like!

To get started, download this repository as a .zip and run "run_tev.bat"

Here are some commands and changes that may be needed for creating your own Tev!
- ***python -c "import secrets; print(secrets.token_hex(32))"*** | Use this to generate a secret key, which you should replace the secret key string in AI/server.py line 61 to
- ***Website/index.html; Website/style.css*** | Alter these in any way you like! You can rename the AI, change how it looks, etc.
- ***AI/personality.txt*** | Change this to a short paragraph of how you want the AI to act!
- ***Desktop/package.json*** | Change this data to the data of your AI!
