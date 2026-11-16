Pod::Spec.new do |s|
  s.name = 'TcpPrinterPlugin'
  s.version = '1.0.0'
  s.summary = 'Direct TCP printing for 7anouti POS'
  s.license = { :type => 'MIT' }
  s.homepage = 'https://github.com/calypsostore/cafeteria-POS'
  s.author = '7anouti POS'
  s.source = { :git => 'https://github.com/calypsostore/cafeteria-POS.git', :tag => s.version.to_s }
  s.source_files = 'Sources/**/*.{swift,h,m,mm}'
  s.ios.deployment_target = '15.0'
  s.swift_version = '5.1'
  s.dependency 'Capacitor'
end
