replacements = "      🚨 Жалоба от \n📞 Линия: ,"
import sys
sys.stdout.buffer.write(str(list(replacements)).encode('utf-8'))
