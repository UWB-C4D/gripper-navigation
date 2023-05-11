REX.HMI.init = function(){
  
  REX.WebBuDi.addSection({
    column: 1,
    title: 'Save image',
    rows: [
      {type: 'MP', alias: 'SAVE', cstring:"python_in_task.MP_SAVE:BSTATE", desc: 'Save image', label:"SAVE"},
	  {type: 'AR', alias: 'no_save_images', cstring:"python_out_task:y1", desc: 'No. of saved images'},      	  
	  {type: 'MP', alias: 'CALIBRATE', cstring:"python_in_task.MP_CALIBRATE:BSTATE"},
	  {type:'ALT', alias:"state", cstring:"python_out_task:y0",
		values:{"-1":"ERROR", "0":"NOT READY", "1":"DONE"}, show_key: false},
	  {type: 'MP', alias: 'RESET', cstring:"python_in_task.MP_RESET:BSTATE"}
    ]
  });

  // Change title of the page
  REX.HMI.setTitle('Save calibration image');
}