import sys
sys.path.insert(0, "backend")
from resource_allocator import allocate

class X:
    def __init__(self, rid, typ, status="AVAILABLE"):
        self.resource_id=rid; self.resource_type=typ; self.status=status
        self.capabilities=typ.lower(); self.latitude=17; self.longitude=82; self.id=1

class I:
    id=1; latitude=17; longitude=82

def test_available_resource_is_selected():
    r=allocate(I(), [X("A","Ambulance"), X("B","Ambulance","BUSY")], ["ambulance"])
    assert len(r)==1 and r[0]["resource_id"]=="A"

def test_busy_resource_is_not_selected():
    r=allocate(I(), [X("B","Ambulance","BUSY")], ["ambulance"])
    assert r==[]
