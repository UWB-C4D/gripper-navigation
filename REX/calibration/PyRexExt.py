import sys
from pathlib import Path

def eprint(*args, **kwargs):
    print('  [ERR]:',*args, file=sys.stderr, **kwargs)

class Item:
    def __init__(self):
        self.v = None

    def __getitem__(self, key):
        if self.v is None:
            return None
        if type(key) is tuple:
            return self.v[key[0]][key[1]]
        else:
            return self.v[key]

# Standard linux path
data_path = '/rex/data'
if not Path(data_path).exists():
    data_path = str(Path(__file__).parent.absolute().joinpath('./data'))

class REX:
    """
    Objekt REX, ktery nahrazuje objekt co se pridava standardne pokud se skript vola v bloku PYTHON
    Jedna se pouze o pseudo tridu aby se mohlo pouzivat standardni volani funkci pro REXYGEN
    Vhoddný například pro lokální debuggování pomocí VSCode
    """    
    RexDataPath = data_path
    verbose = False

    @staticmethod
    def Trace(*args):
        if REX.verbose:
            print("[DEBUG]:", *args)

    @staticmethod
    def TraceInfo(*args):
        print(" [INFO]:", *args)

    @staticmethod
    def TraceWarning(*args):
        print(" [WARN]:", *args)

    @staticmethod
    def TraceError(*args):
        eprint(*args)

    # Zadefinovani prazdnych vstupu, vystupu a parametru
    u0 = Item(); u1 = Item(); u2 = Item(); u3 = Item()
    u4 = Item();u5 = Item(); u6 = Item(); u7 = Item()
    u8 = Item(); u9 = Item(); u10 = Item(); u11 = Item()
    u12 = Item(); u13 = Item(); u14 = Item(); u15 = Item()

    y0 = Item(); y1 = Item(); y2 = Item(); y3 = Item()
    y4 = Item();y5 = Item(); y6 = Item(); y7 = Item()
    y8 = Item(); y9 = Item(); y10 = Item(); y11 = Item()
    y12 = Item(); y13 = Item(); y14 = Item(); y15 = Item()

    p0 = Item(); p1 = Item(); p2 = Item(); p3 = Item()
    p4 = Item();p5 = Item(); p6 = Item(); p7 = Item()
    p8 = Item(); p9 = Item(); p10 = Item(); p11 = Item()
    p12 = Item(); p13 = Item(); p14 = Item(); p15 = Item()
