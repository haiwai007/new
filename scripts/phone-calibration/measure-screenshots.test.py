"""Offline measurement integrity checks; generated fixtures contain no publisher images."""
import hashlib,json,subprocess,sys,tempfile,unittest
from pathlib import Path
from PIL import Image,ImageDraw
SCRIPT=Path(__file__).with_name('measure-screenshots.py')
class MeasurementIntegrity(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.file=self.root/'reference.png'
  image=Image.new('RGB',(40,20),'black');draw=ImageDraw.Draw(image);draw.rectangle((2,3,5,7),fill='white');draw.rectangle((31,4,34,8),fill='white');draw.point((37,1),fill='white');image.save(self.file)
  self.row=dict(id='fixture',file=str(self.file),width=40,height=20,stripHeight=20,clockFraction=.5,light=True,minComponentArea=2,sha256=hashlib.sha256(self.file.read_bytes()).hexdigest())
 def tearDown(self):self.temp.cleanup()
 def run_measure(self):
  config=self.root/'input.json';config.write_text(json.dumps([self.row]));out=self.root/'output.json';result=subprocess.run([sys.executable,str(SCRIPT),str(config),str(out)],capture_output=True,text=True);return result,out
 def test_native_boxes_ignore_an_isolated_background_speck(self):
  result,out=self.run_measure();self.assertEqual(result.returncode,0,result.stderr);row=json.loads(out.read_text())[0];self.assertEqual(row['clockBox'],dict(left=2,top=3,right=6,bottom=8));self.assertEqual(row['systemBox'],dict(left=31,top=4,right=35,bottom=9));self.assertNotIn('file',row)
 def test_modified_source_cannot_silently_replace_reviewed_hash(self):
  self.row['sha256']='0'*64;result,out=self.run_measure();self.assertNotEqual(result.returncode,0);self.assertIn('Source hash changed',result.stderr);self.assertFalse(out.exists())
 def test_clock_clipped_by_roi_requires_review(self):
  self.row['clockRect']=[3,3,2,5];result,out=self.run_measure();self.assertNotEqual(result.returncode,0);self.assertIn('Clock touches ROI border',result.stderr);self.assertFalse(out.exists())
 def test_resampled_dimensions_are_not_accepted(self):
  self.row['width']=80;result,out=self.run_measure();self.assertNotEqual(result.returncode,0);self.assertIn('Native dimensions do not match',result.stderr);self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
